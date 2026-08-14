-- =====================================================================================
-- 12_profile_completion.sql
-- =====================================================================================

-- Crée la fonction RPC pour calculer le pourcentage de complétion du profil.
-- Appelé par l'application via `supabase.rpc("my_profile_completion")`.

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
    -- Récupérer le profil de l'utilisateur connecté
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

    -- Retourner le pourcentage (plafonné à 100)
    RETURN LEAST(100, ROUND((score::numeric / total::numeric) * 100));
END;
$$;
