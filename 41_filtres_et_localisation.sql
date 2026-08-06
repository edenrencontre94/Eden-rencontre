-- ============================================================
-- Filtres de découverte et localisation
-- ============================================================
-- PROBLÈME DE FOND corrigé ici.
--
-- Les filtres étaient appliqués DANS LE NAVIGATEUR, sur un lot de 100
-- profils déjà chargés. Filtrer sur « Sénégal » ne cherchait donc pas les
-- Sénégalais de la base : cela ne gardait que ceux qui se trouvaient déjà,
-- par hasard, dans les 100 tirés. Avec quelques milliers de membres, un
-- filtre pouvait ne rien renvoyer alors que des centaines de profils
-- correspondaient.
--
-- Tout passe désormais par une fonction : la base filtre, trie, et ne
-- renvoie que ce qui correspond réellement.
--
-- Répartition demandée :
--   GRATUIT        — pays, tranche d'âge
--   PREMIUM & VIP  — situation matrimoniale, distance (géolocalisation),
--                    dénomination, fréquentation de l'église, niveau
--                    d'études, intention de mariage, taille

-- ------------------------------------------------------------
-- 1. Localisation
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone,
  -- Consentement explicite. Une position enregistrée une fois ne vaut pas
  -- autorisation permanente : couper le partage doit rendre le profil
  -- indistanciable, sans effacer la donnée si l'on réactive plus tard.
  ADD COLUMN IF NOT EXISTS share_location boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_coordonnees_valides') THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_coordonnees_valides
    CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_localisation_idx
ON public.profiles (latitude, longitude) WHERE share_location;

/**
 * Distance à vol d'oiseau, en kilomètres (formule de haversine).
 *
 * PostGIS ferait mieux, mais l'extension n'est pas activée et l'imposer
 * pour un rayon de recherche serait disproportionné : à ces distances,
 * l'écart avec une projection exacte est de l'ordre du demi-pourcent.
 */
CREATE OR REPLACE FUNCTION public.distance_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN NULL
    ELSE 6371 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2))
      * power(sin(radians(lon2 - lon1) / 2), 2)
    ))
  END;
$$;

-- Enregistrement de sa propre position. Impossible d'écrire celle d'un
-- autre : la fonction n'accepte aucun identifiant.
CREATE OR REPLACE FUNCTION public.set_my_location(
  p_lat double precision,
  p_lng double precision,
  p_share boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;

  IF p_share AND (p_lat IS NULL OR p_lng IS NULL) THEN
    RAISE EXCEPTION 'COORDS_REQUIRED';
  END IF;

  UPDATE public.profiles SET
    -- Arrondi à trois décimales, soit ~100 m. Suffisant pour un rayon de
    -- recherche, et cela évite de stocker l'adresse exacte de quelqu'un.
    latitude  = CASE WHEN p_share THEN round(p_lat::numeric, 3)::double precision ELSE latitude END,
    longitude = CASE WHEN p_share THEN round(p_lng::numeric, 3)::double precision ELSE longitude END,
    location_updated_at = CASE WHEN p_share THEN timezone('utc'::text, now()) ELSE location_updated_at END,
    share_location = p_share
  WHERE id = v_user;

  RETURN jsonb_build_object('ok', true, 'share', p_share);
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_location(double precision, double precision, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_location(double precision, double precision, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_location(double precision, double precision, boolean) TO authenticated;

-- ------------------------------------------------------------
-- 2. Valeurs disponibles pour alimenter les listes déroulantes
-- ------------------------------------------------------------
-- Proposer « Sénégal » quand aucun Sénégalais n'est inscrit produit un
-- filtre qui ne renvoie rien. Les options viennent donc des données.
CREATE OR REPLACE FUNCTION public.filter_options()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pays', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('valeur', country, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT country, count(*) AS n FROM public.profiles
        WHERE COALESCE(country, '') <> '' AND COALESCE(visibility, 'tous') <> 'pause'
        GROUP BY country
      ) x
    ),
    'denominations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('valeur', denomination, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT denomination, count(*) AS n FROM public.profiles
        WHERE COALESCE(denomination, '') <> '' AND COALESCE(visibility, 'tous') <> 'pause'
        GROUP BY denomination
      ) x
    ),
    'frequentation', (
      SELECT COALESCE(jsonb_agg(DISTINCT church_attendance), '[]'::jsonb)
      FROM public.profiles WHERE COALESCE(church_attendance, '') <> ''
    ),
    'etudes', (
      SELECT COALESCE(jsonb_agg(DISTINCT education), '[]'::jsonb)
      FROM public.profiles WHERE COALESCE(education, '') <> ''
    ),
    'intentions', (
      SELECT COALESCE(jsonb_agg(DISTINCT marriage_intent), '[]'::jsonb)
      FROM public.profiles WHERE COALESCE(marriage_intent, '') <> ''
    )
  );
$$;

REVOKE ALL ON FUNCTION public.filter_options() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.filter_options() FROM anon;
GRANT EXECUTE ON FUNCTION public.filter_options() TO authenticated;

-- ------------------------------------------------------------
-- 3. La découverte, filtrée en base
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discover_profiles(
  -- Filtres de base, ouverts à tous
  p_country      text    DEFAULT NULL,
  p_age_min      integer DEFAULT NULL,
  p_age_max      integer DEFAULT NULL,
  -- Filtres avancés, réservés aux formules payantes
  p_marital      text[]  DEFAULT NULL,
  p_denomination text[]  DEFAULT NULL,
  p_attendance   text[]  DEFAULT NULL,
  p_education    text[]  DEFAULT NULL,
  p_intent       text[]  DEFAULT NULL,
  p_height_min   integer DEFAULT NULL,
  p_height_max   integer DEFAULT NULL,
  p_max_km       integer DEFAULT NULL,
  p_verified     boolean DEFAULT NULL,
  p_limit        integer DEFAULT 100
)
RETURNS TABLE (
  id uuid, first_name text, last_name text, birth_date date,
  city text, country text, denomination text, photos text[], bio text,
  is_verified boolean, boosted_until timestamp with time zone,
  practice_level text, church_attendance text, marriage_intent text,
  wants_children text, last_seen timestamp with time zone,
  marital_status text, marriage_vision text, looking_for text,
  education text, height_cm smallint,
  interests text[], qualities text[], flaws text[], dealbreakers text[],
  distance_km double precision
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_level smallint;
  v_seek  text;
  v_lat   double precision;
  v_lng   double precision;
  v_avance boolean;
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;

  v_level := public.effective_level(v_user);
  v_avance := v_level >= 1;

  SELECT p.seeking_gender, p.latitude, p.longitude
  INTO v_seek, v_lat, v_lng
  FROM public.profiles p WHERE p.id = v_user;

  -- Les filtres avancés sont ANNULÉS pour un compte gratuit plutôt que
  -- refusés : une requête forgée ne doit pas provoquer d'erreur, elle doit
  -- simplement ne rien obtenir de plus qu'un autre compte gratuit.
  IF NOT v_avance THEN
    p_marital := NULL; p_denomination := NULL; p_attendance := NULL;
    p_education := NULL; p_intent := NULL;
    p_height_min := NULL; p_height_max := NULL; p_max_km := NULL;
  END IF;

  RETURN QUERY
  SELECT
    t.id, t.first_name, t.last_name, t.birth_date,
    t.city, t.country, t.denomination, t.photos, t.bio,
    t.is_verified, t.boosted_until,
    t.practice_level, t.church_attendance, t.marriage_intent,
    t.wants_children, t.last_seen,
    t.marital_status, t.marriage_vision, t.looking_for,
    t.education, t.height_cm,
    t.interests, t.qualities, t.flaws, t.dealbreakers,
    CASE
      WHEN v_lat IS NULL OR NOT t.share_location THEN NULL
      ELSE public.distance_km(v_lat, v_lng, t.latitude, t.longitude)
    END AS distance_km
  FROM public.profiles t
  WHERE t.id <> v_user

    -- Visibilité : « pause » invisible ; « demande » réservé à ceux que
    -- la personne a elle-même likés.
    AND COALESCE(t.visibility, 'tous') <> 'pause'
    AND (
      COALESCE(t.visibility, 'tous') <> 'demande'
      OR EXISTS (
        SELECT 1 FROM public.swipes s
        WHERE s.swiper_id = t.id AND s.target_id = v_user
          AND s.action IN ('like', 'superlike')
      )
    )

    -- Déjà vus, et blocages dans les deux sens
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes s WHERE s.swiper_id = v_user AND s.target_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_user AND b.blocked_id = t.id)
         OR (b.blocker_id = t.id AND b.blocked_id = v_user)
    )

    AND (v_seek IS NULL OR v_seek = 'all' OR t.gender = v_seek)

    -- ── Filtres de base ────────────────────────────────────
    AND (p_country IS NULL OR t.country = p_country)
    AND (p_age_min IS NULL OR t.birth_date IS NULL
         OR t.birth_date <= (current_date - make_interval(years => p_age_min)))
    AND (p_age_max IS NULL OR t.birth_date IS NULL
         OR t.birth_date >= (current_date - make_interval(years => p_age_max + 1)))

    -- ── Filtres avancés ────────────────────────────────────
    AND (p_marital      IS NULL OR t.marital_status    = ANY(p_marital))
    AND (p_denomination IS NULL OR t.denomination      = ANY(p_denomination))
    AND (p_attendance   IS NULL OR t.church_attendance = ANY(p_attendance))
    AND (p_education    IS NULL OR t.education         = ANY(p_education))
    AND (p_intent       IS NULL OR t.marriage_intent   = ANY(p_intent))
    AND (p_height_min IS NULL OR t.height_cm >= p_height_min)
    AND (p_height_max IS NULL OR t.height_cm <= p_height_max)
    AND (p_verified IS NULL OR NOT p_verified OR COALESCE(t.is_verified, false))

    -- Rayon : sans position de part et d'autre, le filtre ne peut pas
    -- s'appliquer et le profil est écarté plutôt qu'inclus au hasard.
    AND (
      p_max_km IS NULL
      OR (
        v_lat IS NOT NULL AND t.share_location
        AND public.distance_km(v_lat, v_lng, t.latitude, t.longitude) <= p_max_km
      )
    )

  ORDER BY
    -- Le Boost passe devant : c'est ce pour quoi il est payé.
    (t.boosted_until IS NOT NULL AND t.boosted_until > timezone('utc'::text, now())) DESC,
    -- Puis la proximité si elle est connue, sinon l'activité récente.
    CASE
      WHEN v_lat IS NULL OR NOT t.share_location THEN NULL
      ELSE public.distance_km(v_lat, v_lng, t.latitude, t.longitude)
    END ASC NULLS LAST,
    t.last_seen DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 200));
END;
$$;

REVOKE ALL ON FUNCTION public.discover_profiles(
  text, integer, integer, text[], text[], text[], text[], text[],
  integer, integer, integer, boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.discover_profiles(
  text, integer, integer, text[], text[], text[], text[], text[],
  integer, integer, integer, boolean, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(
  text, integer, integer, text[], text[], text[], text[], text[],
  integer, integer, integer, boolean, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 4. Contrôle
-- ------------------------------------------------------------
SELECT public.filter_options() AS options;

-- Doit renvoyer des profils, avec distance_km à NULL tant que personne
-- n'a activé le partage de position.
SELECT id, first_name, country, marital_status, height_cm, distance_km
FROM public.discover_profiles(p_limit => 5);
