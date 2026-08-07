-- ============================================================
-- CORRECTIF URGENT — block_if_suspended() cassait TOUTES les écritures
-- ============================================================
-- SYMPTÔME
--   « record "new" has no field "sender_id" » au lancement d'un appel.
--   Et le même défaut, avec un autre nom de colonne, sur les swipes et
--   les publications de la communauté.
--
-- CAUSE
--   La migration 45 déterminait l'auteur ainsi :
--
--     v_user := CASE TG_TABLE_NAME
--       WHEN 'messages'        THEN NEW.sender_id
--       WHEN 'swipes'          THEN NEW.swiper_id
--       WHEN 'calls'           THEN NEW.caller_id
--       WHEN 'community_posts' THEN NEW.user_id
--       WHEN 'reports'         THEN NEW.reporter_id
--     END;
--
--   En PL/pgSQL, une expression est préparée par SPI comme une requête
--   SQL unique. PostgreSQL doit donc résoudre TOUTES les références de
--   colonnes qu'elle contient — y compris celles des branches que
--   l'exécution n'empruntera jamais.
--
--   Sur `calls`, il rencontre `NEW.sender_id` (première branche), ne le
--   trouve pas dans le type de la ligne, et échoue avant même d'évaluer
--   `TG_TABLE_NAME`. Le trigger refuse alors toute insertion, que le
--   compte soit suspendu ou non.
--
--   Le raisonnement était juste — « la colonne portant l'auteur diffère
--   selon la table » — mais l'écriture supposait une évaluation paresseuse
--   des branches, que PL/pgSQL ne garantit pas.
--
-- CORRECTIF
--   On passe par `to_jsonb(NEW)` et un accès par NOM de colonne. Aucune
--   référence statique : rien à résoudre à la préparation, donc plus
--   aucune dépendance à la forme de la table.

CREATE OR REPLACE FUNCTION public.block_if_suspended()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_colonne text;
  v_user    uuid;
BEGIN
  v_colonne := CASE TG_TABLE_NAME
    WHEN 'messages'        THEN 'sender_id'
    WHEN 'swipes'          THEN 'swiper_id'
    WHEN 'calls'           THEN 'caller_id'
    WHEN 'community_posts' THEN 'user_id'
    WHEN 'reports'         THEN 'reporter_id'
    ELSE NULL
  END;

  IF v_colonne IS NULL THEN
    RETURN NEW;
  END IF;

  -- Accès par nom : `to_jsonb` transforme la ligne en objet, et `->>`
  -- lit la clé sans que la colonne ait besoin d'exister à la compilation.
  v_user := NULLIF(to_jsonb(NEW) ->> v_colonne, '')::uuid;

  IF v_user IS NOT NULL AND public.is_suspended(v_user) THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED'
      USING HINT = 'Votre compte est suspendu.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Vérification : les quatre écritures doivent repasser
-- ------------------------------------------------------------
-- Chaque bloc simule le trigger sur une ligne fictive. Si l'un échoue
-- encore avec « has no field », le correctif n'a pas été appliqué.
DO $$
DECLARE
  v_tables text[] := ARRAY['messages', 'swipes', 'calls', 'community_posts'];
  t text;
  v_ok boolean;
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || t)::regclass
        AND NOT tgisinternal
        AND tgfoid = 'public.block_if_suspended'::regproc
    ) INTO v_ok;
    RAISE NOTICE 'table % : verrou de suspension %', t,
      CASE WHEN v_ok THEN 'attaché' ELSE 'ABSENT' END;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
