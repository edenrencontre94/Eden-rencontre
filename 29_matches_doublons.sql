-- ============================================================
-- Correctif : matches en double
-- ============================================================
-- Un même interlocuteur apparaissait deux fois dans /demandes et /messages.
-- Les deux pages lisent `matches` : il y avait donc bien deux lignes pour
-- la même paire.
--
-- Cause probable : un trigger de création de match préexistant (posé par
-- Lovable dans le schéma initial) coexistant avec `on_swipe_create_match`
-- ajouté en migration 15. Chacun vérifie l'absence de doublon, mais deux
-- INSERT concurrents dans la même transaction peuvent passer la vérification
-- avant que l'autre n'ait écrit.
--
-- Le diagnostic est en section 1, mais le correctif ne dépend pas de la
-- cause : une contrainte d'unicité rend le doublon IMPOSSIBLE, quel que
-- soit le nombre de triggers.

-- ------------------------------------------------------------
-- 1. Diagnostic — quels triggers écrivent dans matches ?
-- ------------------------------------------------------------
SELECT tgname AS trigger_name, tgrelid::regclass AS sur_la_table
FROM pg_trigger
WHERE NOT tgisinternal AND tgrelid = 'public.swipes'::regclass;

-- Combien de paires sont en double ?
SELECT count(*) AS paires_en_double
FROM (
  SELECT LEAST(user1_id, user2_id) a, GREATEST(user1_id, user2_id) b
  FROM public.matches
  GROUP BY 1, 2
  HAVING count(*) > 1
) d;

-- ------------------------------------------------------------
-- 2. Rattacher les messages avant toute suppression
-- ------------------------------------------------------------
-- `messages.match_id` référence `matches` en CASCADE : supprimer un doublon
-- sans déplacer ses messages effacerait des conversations. On conserve la
-- ligne la plus ancienne et on lui rattache tout le reste.
CREATE TEMP TABLE _match_dedupe AS
SELECT
  id AS doublon,
  first_value(id) OVER (
    PARTITION BY LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id)
    ORDER BY created_at, id
  ) AS conserve
FROM public.matches;

DELETE FROM _match_dedupe WHERE doublon = conserve;

UPDATE public.messages m
SET match_id = d.conserve
FROM _match_dedupe d
WHERE m.match_id = d.doublon;

-- Idem pour les appels, s'ils existent déjà
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'calls') THEN
    EXECUTE 'UPDATE public.calls c SET match_id = d.conserve
             FROM _match_dedupe d WHERE c.match_id = d.doublon';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Supprimer les doublons
-- ------------------------------------------------------------
DELETE FROM public.matches m
USING _match_dedupe d
WHERE m.id = d.doublon;

-- ------------------------------------------------------------
-- 4. Rendre le doublon impossible
-- ------------------------------------------------------------
-- LEAST/GREATEST normalise la paire : (A,B) et (B,A) produisent la même
-- clé. Peu importe désormais combien de triggers tentent d'insérer —
-- le second échouera.
CREATE UNIQUE INDEX IF NOT EXISTS matches_pair_uidx
ON public.matches (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id));

-- ------------------------------------------------------------
-- 5. Le trigger doit tolérer ce refus
-- ------------------------------------------------------------
-- Sans ce ON CONFLICT, la contrainte ferait échouer le swipe lui-même :
-- l'utilisateur verrait une erreur alors que son like est légitime.
CREATE OR REPLACE FUNCTION public.create_match_on_mutual_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.action NOT IN ('like', 'superlike') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.swipes s
    WHERE s.swiper_id = NEW.target_id
      AND s.target_id = NEW.swiper_id
      AND s.action IN ('like', 'superlike')
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.matches (user1_id, user2_id)
    VALUES (NEW.swiper_id, NEW.target_id);
  EXCEPTION
    WHEN unique_violation THEN
      -- Le match existe déjà : ce n'est pas une erreur, on continue.
      NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_swipe_create_match ON public.swipes;
CREATE TRIGGER on_swipe_create_match
AFTER INSERT ON public.swipes
FOR EACH ROW EXECUTE FUNCTION public.create_match_on_mutual_like();

-- ------------------------------------------------------------
-- 6. Contrôle final — doit renvoyer 0
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.matches) AS matches_restants,
  (SELECT count(*) FROM (
     SELECT LEAST(user1_id, user2_id) a, GREATEST(user1_id, user2_id) b
     FROM public.matches GROUP BY 1, 2 HAVING count(*) > 1
   ) x) AS doublons_restants;
