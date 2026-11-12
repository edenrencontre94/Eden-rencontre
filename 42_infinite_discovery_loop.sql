-- ==============================================================================
-- 42_infinite_discovery_loop.sql
-- Permet aux utilisateurs de swiper et découvrir les profils en boucle sans fin
-- sans jamais être bloqués par "Plus aucun profil".
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.discover_profiles(
  p_country TEXT DEFAULT NULL,
  p_age_min INT DEFAULT 18,
  p_age_max INT DEFAULT 70,
  p_marital TEXT[] DEFAULT NULL,
  p_denomination TEXT[] DEFAULT NULL,
  p_attendance TEXT[] DEFAULT NULL,
  p_education TEXT[] DEFAULT NULL,
  p_intent TEXT[] DEFAULT NULL,
  p_height_min INT DEFAULT NULL,
  p_height_max INT DEFAULT NULL,
  p_max_km FLOAT DEFAULT NULL,
  p_verified BOOLEAN DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS SETOF public.profiles
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  current_gender TEXT;
  current_seeking TEXT;
BEGIN
  SELECT gender, seeking_gender INTO current_gender, current_seeking
  FROM public.profiles WHERE id = uid;

  RETURN QUERY
  SELECT p.* FROM public.profiles p
  WHERE
    -- Exclure soi-même
    p.id <> uid
    -- Exclure les profils masqués ou suspendus
    AND COALESCE(p.visibility, 'tous') <> 'pause'
    AND COALESCE(p.is_suspended, false) = false
    AND COALESCE(p.is_paused, false) = false
    -- Exclure les utilisateurs bloqués (dans les deux sens)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = uid AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = uid)
    )
    -- Genre cherché (si renseigné)
    AND (current_seeking IS NULL OR current_seeking = '' OR p.gender = current_seeking)
    -- Genre de l'autre (respect de sa préférence si renseignée)
    AND (p.seeking_gender IS NULL OR p.seeking_gender = '' OR p.seeking_gender = current_gender)
    -- Âge
    AND (p.birth_date IS NULL OR EXTRACT(YEAR FROM age(p.birth_date)) BETWEEN p_age_min AND p_age_max)
    -- Pays
    AND (p_country IS NULL OR p_country = '' OR p.country = p_country)
    -- Filtres avancés (optionnels)
    AND (p_marital IS NULL OR p.marital_status = ANY(p_marital))
    AND (p_denomination IS NULL OR p.denomination = ANY(p_denomination))
    AND (p_attendance IS NULL OR p.church_attendance = ANY(p_attendance))
    AND (p_education IS NULL OR p.education = ANY(p_education))
    AND (p_intent IS NULL OR p.marriage_intent = ANY(p_intent))
    AND (p_height_min IS NULL OR p.height_cm >= p_height_min)
    AND (p_height_max IS NULL OR p.height_cm <= p_height_max)
    AND (p_verified IS NULL OR p.is_verified = p_verified)
    -- Au moins une photo
    AND p.photos IS NOT NULL AND array_length(p.photos, 1) > 0
  ORDER BY 
    -- Les profils pas encore swipés apparaissent en premier
    (EXISTS (SELECT 1 FROM public.swipes s WHERE s.actor_id = uid AND s.target_id = p.id)) ASC,
    p.premium_until DESC NULLS LAST, 
    RANDOM()
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_profiles TO authenticated;

