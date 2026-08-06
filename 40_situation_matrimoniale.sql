-- ============================================================
-- Situation matrimoniale
-- ============================================================
-- Sur une plateforme orientée vers le mariage, c'est le fait le plus
-- déterminant du profil — devant la taille et le niveau d'études. Il est
-- donc rattaché au bloc « Mon chemin vers le mariage » et non à
-- « Qui je suis ».
--
-- « Marié(e) » ne figure PAS dans les valeurs admises. Ce n'est pas un
-- oubli : proposer ce choix reviendrait à laisser entendre qu'on peut
-- chercher ici en étant déjà engagé. La contrainte le refuse en base, pas
-- seulement dans le menu déroulant.

-- ------------------------------------------------------------
-- 1. La colonne
-- ------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS marital_status text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_marital_status_valide') THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_marital_status_valide
    CHECK (
      marital_status IS NULL OR marital_status IN (
        'celibataire',
        'divorce',
        'veuf',
        'separe',       -- séparé de fait, union non encore dissoute
        'annule'        -- mariage religieux annulé
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_marital_status_idx
ON public.profiles (marital_status);

-- ------------------------------------------------------------
-- 2. Le taux de complétion en tient compte
-- ------------------------------------------------------------
-- Poids 3, comme la date de naissance : c'est une information qu'un profil
-- sérieux ne peut pas passer sous silence.
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

  -- Essentiel
  v_total := v_total + 18;
  IF COALESCE(array_length(p.photos, 1), 0) >= 3 THEN v_gagne := v_gagne + 6;
  ELSIF COALESCE(array_length(p.photos, 1), 0) >= 1 THEN v_gagne := v_gagne + 3; END IF;
  IF length(trim(COALESCE(p.bio, ''))) >= 80 THEN v_gagne := v_gagne + 6;
  ELSIF length(trim(COALESCE(p.bio, ''))) >= 20 THEN v_gagne := v_gagne + 3; END IF;
  IF p.birth_date IS NOT NULL THEN v_gagne := v_gagne + 3; END IF;
  IF COALESCE(p.marital_status, '') <> '' THEN v_gagne := v_gagne + 3; END IF;

  -- Identité et foi
  v_total := v_total + 12;
  IF COALESCE(p.city, '') <> ''             THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.country, '') <> ''          THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.denomination, '') <> ''     THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.practice_level, '') <> ''   THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.church_attendance, '') <> ''THEN v_gagne := v_gagne + 2; END IF;
  IF COALESCE(p.marriage_intent, '') <> ''  THEN v_gagne := v_gagne + 2; END IF;

  -- Champs complémentaires
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

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 3. Contrôle
-- ------------------------------------------------------------
SELECT
  COALESCE(marital_status, 'non renseigné') AS situation,
  count(*)                                  AS membres
FROM public.profiles
GROUP BY marital_status
ORDER BY count(*) DESC;
