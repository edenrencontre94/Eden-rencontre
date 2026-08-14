-- =====================================================================================
-- 13_harmonize_db.sql
-- =====================================================================================
-- Ce script corrige les données et harmonise la base suite à la suppression des offres VIP et Boost.
-- À exécuter dans le SQL Editor de votre projet Supabase.

-- 1. Nettoyage des paramètres d'application (remplacement de "vip" par "1" pour le niveau Premium)
UPDATE public.app_settings
SET value = '1'::jsonb
WHERE key IN ('min_level_post_video', 'min_level_video_call', 'min_level_video_message')
  AND value = '"vip"'::jsonb;

-- 2. Harmonisation des profils existants : conversion du palier VIP en Premium
-- Note: il n'y a pas de table public.subscriptions, tout est sur public.profiles
UPDATE public.profiles
SET public_plan = 'premium'
WHERE public_plan = 'vip';

-- 3. Ajout / Mise à jour de la fonction my_profile_completion
-- Indispensable pour l'affichage du pourcentage de profil (qui était bloqué sur null si la fonction manquait).
CREATE OR REPLACE FUNCTION public.my_profile_completion()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    score integer := 0;
    total integer := 18;
    p RECORD;
BEGIN
    SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Informations de base
    IF p.first_name IS NOT NULL AND trim(p.first_name) <> '' THEN score := score + 1; END IF;
    IF p.last_name IS NOT NULL AND trim(p.last_name) <> '' THEN score := score + 1; END IF;
    IF p.birth_date IS NOT NULL THEN score := score + 1; END IF;
    IF p.gender IS NOT NULL AND trim(p.gender) <> '' THEN score := score + 1; END IF;
    IF p.city IS NOT NULL AND trim(p.city) <> '' THEN score := score + 1; END IF;
    IF p.country IS NOT NULL AND trim(p.country) <> '' THEN score := score + 1; END IF;
    
    -- Photos et présentation
    IF p.photos IS NOT NULL AND array_length(p.photos, 1) > 0 THEN score := score + 1; END IF;
    IF p.bio IS NOT NULL AND trim(p.bio) <> '' THEN score := score + 1; END IF;
    
    -- Foi
    IF p.denomination IS NOT NULL AND trim(p.denomination) <> '' THEN score := score + 1; END IF;
    IF p.practice_level IS NOT NULL AND trim(p.practice_level) <> '' THEN score := score + 1; END IF;
    IF p.church_attendance IS NOT NULL AND trim(p.church_attendance) <> '' THEN score := score + 1; END IF;
    
    -- Recherche et vision
    IF p.seeking_gender IS NOT NULL AND trim(p.seeking_gender) <> '' THEN score := score + 1; END IF;
    IF p.marriage_intent IS NOT NULL AND trim(p.marriage_intent) <> '' THEN score := score + 1; END IF;
    IF p.wants_children IS NOT NULL AND trim(p.wants_children) <> '' THEN score := score + 1; END IF;
    IF p.marital_status IS NOT NULL AND trim(p.marital_status) <> '' THEN score := score + 1; END IF;
    
    -- Détails
    IF p.education IS NOT NULL AND trim(p.education) <> '' THEN score := score + 1; END IF;
    IF p.height IS NOT NULL OR p.height_cm IS NOT NULL THEN score := score + 1; END IF;
    
    -- Intérêts
    IF p.interests IS NOT NULL AND array_length(p.interests, 1) > 0 THEN score := score + 1; END IF;

    RETURN LEAST(100, ROUND((score::numeric / total::numeric) * 100));
END;
$$;
