-- =====================================================================================
-- 03_eden_functions.sql - Triggers et Fonctions pour Eden Rencontre
-- =====================================================================================

-- Fonction appelée par le trigger pour créer un match automatiquement
CREATE OR REPLACE FUNCTION public.check_and_create_match()
RETURNS TRIGGER AS $$
DECLARE
    reciprocal_like_exists BOOLEAN;
    u1 UUID;
    u2 UUID;
BEGIN
    -- On ne vérifie que s'il s'agit d'un like ou super_like
    IF NEW.action IN ('like', 'super_like') THEN
        -- Vérifier si l'autre utilisateur a déjà liké
        SELECT EXISTS (
            SELECT 1 FROM public.swipes 
            WHERE actor_id = NEW.target_id 
              AND target_id = NEW.actor_id 
              AND action IN ('like', 'super_like')
        ) INTO reciprocal_like_exists;

        IF reciprocal_like_exists THEN
            -- Déterminer user1 et user2 pour la table matches (user1 < user2)
            IF NEW.actor_id < NEW.target_id THEN
                u1 := NEW.actor_id;
                u2 := NEW.target_id;
            ELSE
                u1 := NEW.target_id;
                u2 := NEW.actor_id;
            END IF;

            -- Insérer le match (ON CONFLICT DO NOTHING grâce à UNIQUE)
            INSERT INTO public.matches (user1_id, user2_id)
            VALUES (u1, u2)
            ON CONFLICT (user1_id, user2_id) DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur la table swipes
DROP TRIGGER IF EXISTS trigger_check_match ON public.swipes;
CREATE TRIGGER trigger_check_match
AFTER INSERT ON public.swipes
FOR EACH ROW EXECUTE FUNCTION public.check_and_create_match();

-- Fonction pour mettre à jour la colonne updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour la table profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
