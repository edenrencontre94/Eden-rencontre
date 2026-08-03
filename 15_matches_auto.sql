-- ============================================================
-- Migration : création automatique des matches sur like réciproque
-- ============================================================
-- Constat : ni /decouvrir ni /demandes n'insèrent jamais dans `matches`.
-- Ils se contentent de DÉTECTER la réciprocité et d'afficher un toast
-- « C'est un match ! ». Si aucun trigger n'existe côté base, aucun match
-- n'est enregistré — et la messagerie reste donc vide.
--
-- Ce script est sûr même si un trigger équivalent existe déjà : la fonction
-- vérifie l'absence de match dans LES DEUX SENS avant d'insérer, donc deux
-- triggers concurrents ne peuvent pas créer de doublon.

-- ------------------------------------------------------------
-- 1. Diagnostic : triggers déjà présents (regardez le résultat)
-- ------------------------------------------------------------
SELECT tgname AS trigger_name, tgrelid::regclass AS table_cible
FROM pg_trigger
WHERE NOT tgisinternal
ORDER BY 2, 1;

-- ------------------------------------------------------------
-- 2. Fonction : crée le match si le like est réciproque
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_match_on_mutual_like()
RETURNS TRIGGER AS $$
BEGIN
  -- Un « pass » ne peut jamais produire de match
  IF NEW.action NOT IN ('like', 'superlike') THEN
    RETURN NEW;
  END IF;

  -- La cible m'a-t-elle déjà liké ?
  IF NOT EXISTS (
    SELECT 1 FROM public.swipes s
    WHERE s.swiper_id = NEW.target_id
      AND s.target_id = NEW.swiper_id
      AND s.action IN ('like', 'superlike')
  ) THEN
    RETURN NEW;
  END IF;

  -- Match déjà enregistré ? (vérifié dans les deux sens)
  IF EXISTS (
    SELECT 1 FROM public.matches m
    WHERE (m.user1_id = NEW.swiper_id AND m.user2_id = NEW.target_id)
       OR (m.user1_id = NEW.target_id AND m.user2_id = NEW.swiper_id)
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.matches (user1_id, user2_id)
  VALUES (NEW.swiper_id, NEW.target_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_swipe_create_match ON public.swipes;
CREATE TRIGGER on_swipe_create_match
AFTER INSERT ON public.swipes
FOR EACH ROW EXECUTE FUNCTION public.create_match_on_mutual_like();

-- ------------------------------------------------------------
-- 3. Rattrapage : matches manquants pour les likes déjà réciproques
-- ------------------------------------------------------------
INSERT INTO public.matches (user1_id, user2_id)
SELECT DISTINCT
  LEAST(a.swiper_id, a.target_id),
  GREATEST(a.swiper_id, a.target_id)
FROM public.swipes a
JOIN public.swipes b
  ON b.swiper_id = a.target_id
 AND b.target_id = a.swiper_id
WHERE a.action IN ('like', 'superlike')
  AND b.action IN ('like', 'superlike')
  AND NOT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE (m.user1_id = a.swiper_id AND m.user2_id = a.target_id)
       OR (m.user1_id = a.target_id AND m.user2_id = a.swiper_id)
  );

-- ------------------------------------------------------------
-- 4. Vérification : nombre de matches après rattrapage
-- ------------------------------------------------------------
SELECT count(*) AS nb_matches FROM public.matches;
