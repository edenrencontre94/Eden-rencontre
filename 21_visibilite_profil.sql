-- ============================================================
-- Migration : fiabiliser le réglage de visibilité du profil
-- ============================================================
-- La colonne `visibility` existait depuis 04_visibilite_et_visites.sql et
-- l'écran d'accueil l'écrivait bien — mais AUCUNE requête ne la lisait :
-- un profil « En pause » apparaissait quand même dans les découvertes.
-- Le filtrage est désormais appliqué côté application ; ici on verrouille
-- les valeurs possibles et on accélère la lecture.

-- 1. Uniformiser l'existant : les profils créés avant 04 ont un NULL
UPDATE public.profiles
SET visibility = 'tous'
WHERE visibility IS NULL;

-- 2. N'accepter que les trois valeurs prévues
ALTER TABLE public.profiles
ALTER COLUMN visibility SET DEFAULT 'tous';

ALTER TABLE public.profiles
ALTER COLUMN visibility SET NOT NULL;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_visibility_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_visibility_check
CHECK (visibility IN ('tous', 'demande', 'pause'));

-- 3. Index partiel : la découverte écarte les profils en pause à chaque requête
CREATE INDEX IF NOT EXISTS profiles_visible_idx
ON public.profiles (visibility)
WHERE visibility <> 'pause';

-- 4. Contrôle : répartition actuelle
SELECT visibility, count(*) AS nb
FROM public.profiles
GROUP BY visibility
ORDER BY 2 DESC;
