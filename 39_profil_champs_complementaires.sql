-- ============================================================
-- Champs complémentaires du profil
-- ============================================================
-- Huit champs à remplir APRÈS l'inscription. Ils ne sont volontairement
-- pas demandés à la création du compte : allonger le formulaire initial
-- fait abandonner, et ces informations n'ont d'intérêt qu'une fois la
-- personne décidée à rester.
--
-- `marriage_intent` existe déjà et reste inchangé : c'est un choix court
-- (« se marier dans l'année »). `marriage_vision` est le texte libre qui
-- l'explique. Les confondre aurait fait perdre un filtre de recherche
-- pour gagner un paragraphe.

-- ------------------------------------------------------------
-- 1. Les colonnes
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  -- Textes libres
  ADD COLUMN IF NOT EXISTS marriage_vision text,
  ADD COLUMN IF NOT EXISTS looking_for     text,
  -- Choix guidés
  ADD COLUMN IF NOT EXISTS education       text,
  ADD COLUMN IF NOT EXISTS height_cm       smallint,
  -- Listes : un tableau plutôt qu'un texte à virgules. Filtrer sur
  -- « aime la musique » deviendra possible sans réécrire la colonne.
  ADD COLUMN IF NOT EXISTS interests    text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS qualities    text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS flaws        text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dealbreakers text[] DEFAULT '{}'::text[];

-- ------------------------------------------------------------
-- 2. Bornes de saisie
-- ------------------------------------------------------------
-- Sans elles, un tableau de trois cents éléments casserait l'affichage
-- des cartes, et une taille de 3 cm passerait sans broncher.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_height_realistic') THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_height_realistic
    CHECK (height_cm IS NULL OR (height_cm BETWEEN 120 AND 250));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_listes_bornees') THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_listes_bornees
    CHECK (
      COALESCE(array_length(interests, 1), 0)    <= 12
      AND COALESCE(array_length(qualities, 1), 0)    <= 6
      AND COALESCE(array_length(flaws, 1), 0)        <= 6
      AND COALESCE(array_length(dealbreakers, 1), 0) <= 6
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_textes_bornes') THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_textes_bornes
    CHECK (
      length(COALESCE(marriage_vision, '')) <= 600
      AND length(COALESCE(looking_for, ''))     <= 600
    );
  END IF;
END $$;

-- Recherche par centre d'intérêt : sans cet index, filtrer sur un tableau
-- imposerait un parcours complet de la table.
CREATE INDEX IF NOT EXISTS profiles_interests_idx
ON public.profiles USING GIN (interests);

-- ------------------------------------------------------------
-- 3. Taux de complétion, calculé en base
-- ------------------------------------------------------------
-- Le pourcentage était calculé dans /accueil uniquement. Le porter en base
-- lui donne une définition unique : la page profil, la page d'accueil et
-- l'algorithme de classement partagent désormais le même chiffre — sinon
-- ils finiraient par en afficher trois différents.
CREATE OR REPLACE FUNCTION public.profile_completion(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p        record;
  v_total  integer := 0;
  v_gagne  numeric := 0;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Chaque bloc pèse selon son utilité RÉELLE pour une rencontre.
  -- Les photos et la bio décident d'un swipe ; la taille, non.

  -- Essentiel (poids 3)
  v_total := v_total + 15;
  IF COALESCE(array_length(p.photos, 1), 0) >= 3 THEN v_gagne := v_gagne + 6;
  ELSIF COALESCE(array_length(p.photos, 1), 0) >= 1 THEN v_gagne := v_gagne + 3; END IF;
  IF length(trim(COALESCE(p.bio, ''))) >= 80 THEN v_gagne := v_gagne + 6;
  ELSIF length(trim(COALESCE(p.bio, ''))) >= 20 THEN v_gagne := v_gagne + 3; END IF;
  IF p.birth_date IS NOT NULL THEN v_gagne := v_gagne + 3; END IF;

  -- Identité et foi (poids 2 chacun)
  v_total := v_total + 12;
  IF COALESCE(p.city, '') <> ''             THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.country, '') <> ''          THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.denomination, '') <> ''     THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.practice_level, '') <> ''   THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.church_attendance, '') <> ''THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.marriage_intent, '') <> ''  THEN v_gagne := v_gagne + 2; END IF;

  -- Les huit champs complémentaires (poids 2 chacun)
  v_total := v_total + 16;
  IF length(trim(COALESCE(p.marriage_vision, ''))) >= 30 THEN v_gagne := v_gagne + 2; END IF;
  IF length(trim(COALESCE(p.looking_for, '')))     >= 30 THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.education, '') <> ''                     THEN v_gagne := v_gagne + 2; END IF;
  IF p.height_cm IS NOT NULL                             THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(array_length(p.interests, 1), 0)    >= 3   THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(array_length(p.qualities, 1), 0)    >= 2   THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(array_length(p.flaws, 1), 0)        >= 2   THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(array_length(p.dealbreakers, 1), 0) >= 1   THEN v_gagne := v_gagne + 2; END IF;

  RETURN LEAST(100, ROUND((v_gagne / NULLIF(v_total, 0)) * 100)::integer);
END;
$$;

REVOKE ALL ON FUNCTION public.profile_completion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_completion(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.profile_completion(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.profile_completion(uuid) TO service_role;

-- Version sans paramètre, exposable : elle ne peut renseigner que sur
-- soi-même. Celle ci-dessus prend un identifiant et resterait un moyen de
-- sonder la complétude du profil d'autrui.
CREATE OR REPLACE FUNCTION public.my_profile_completion()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.profile_completion(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.my_profile_completion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_profile_completion() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_profile_completion() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 4. Contrôle
-- ------------------------------------------------------------
SELECT
  first_name,
  public.profile_completion(id) AS completion_pct,
  COALESCE(array_length(interests, 1), 0)  AS nb_interets,
  COALESCE(array_length(qualities, 1), 0)  AS nb_qualites,
  height_cm,
  education
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;
