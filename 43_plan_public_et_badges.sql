-- ============================================================
-- Plan public et répartition des membres par offre
-- ============================================================
-- DEUX PROBLÈMES.
--
-- 1. `premium_until` dit JUSQU'À QUAND, jamais QUOI. Impossible de
--    distinguer un abonné Premium d'un VIP pour l'affichage d'un badge :
--    les deux portaient la même couronne, ce qui vidait le VIP de sa
--    distinction — celle qu'on facture trois fois le prix.
--
-- 2. La page /admin/utilisateurs affichait des effectifs INVENTÉS :
--    `premium: 1840`, `vip: 350`, puis `Math.floor(total * 0.15)`. Un
--    tableau de bord qui ment est pire qu'un tableau de bord vide : on
--    prend des décisions dessus.
--
-- `public_plan` dit QUOI, `premium_until` dit JUSQU'À QUAND. Ensemble, le
-- badge s'éteint tout seul à l'expiration, sans tâche planifiée.

-- ------------------------------------------------------------
-- 1. La colonne
-- ------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS public_plan text NOT NULL DEFAULT 'gratuit';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_public_plan_valide') THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_public_plan_valide
    CHECK (public_plan IN ('gratuit', 'premium', 'vip'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_public_plan_idx
ON public.profiles (public_plan) WHERE public_plan <> 'gratuit';

-- ------------------------------------------------------------
-- 2. Entretenue par la base, jamais par le client
-- ------------------------------------------------------------
-- Le badge est une information publique : laissée à la charge du
-- navigateur, elle s'accorderait au premier venu depuis la console.
CREATE OR REPLACE FUNCTION public.sync_public_plan()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles p
  SET
    public_plan = CASE
      WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at > timezone('utc'::text, now())
        THEN NEW.plan_id
      -- Un abonnement expiré ne rétrograde pas immédiatement : c'est
      -- `premium_until` qui décide de l'affichage. Conserver le palier
      -- permet de savoir ce qui a été acheté en dernier.
      ELSE p.public_plan
    END,
    premium_until = GREATEST(COALESCE(p.premium_until, NEW.expires_at), NEW.expires_at)
  WHERE p.id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_plan ON public.subscriptions;
CREATE TRIGGER trg_sync_public_plan
AFTER INSERT OR UPDATE OF plan_id, expires_at ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_public_plan();

-- Reprise de l'existant
UPDATE public.profiles p
SET public_plan = s.plan_id
FROM public.subscriptions s
WHERE s.user_id = p.id
  AND s.plan_id <> 'gratuit'
  AND s.expires_at IS NOT NULL
  AND s.expires_at > timezone('utc'::text, now());

-- Les membres fondateurs ont l'accès VIP sans avoir payé : leur badge doit
-- le refléter, sinon la distinction n'existe que dans les droits.
UPDATE public.profiles SET public_plan = 'vip' WHERE is_founder;

-- ------------------------------------------------------------
-- 3. Répartition réelle, pour le back-office
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_plan_counts()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamp with time zone := timezone('utc'::text, now());
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'total',   (SELECT count(*) FROM public.profiles),
    -- « Gratuit » englobe les abonnements arrivés à échéance : c'est bien
    -- leur situation actuelle, quel que soit ce qu'ils ont payé avant.
    'gratuit', (SELECT count(*) FROM public.profiles
                WHERE NOT is_founder
                  AND (public_plan = 'gratuit' OR premium_until IS NULL OR premium_until <= v_now)),
    'premium', (SELECT count(*) FROM public.profiles
                WHERE NOT is_founder AND public_plan = 'premium' AND premium_until > v_now),
    'vip',     (SELECT count(*) FROM public.profiles
                WHERE is_founder OR (public_plan = 'vip' AND premium_until > v_now)),
    'fondateurs', (SELECT count(*) FROM public.profiles WHERE is_founder),
    -- Anciens abonnés redevenus gratuits : la cible de relance la plus
    -- rentable, puisqu'ils ont déjà payé une fois.
    'expires', (SELECT count(*) FROM public.profiles
                WHERE NOT is_founder AND public_plan <> 'gratuit'
                  AND premium_until IS NOT NULL AND premium_until <= v_now),
    'verifies',     (SELECT count(*) FROM public.profiles WHERE is_verified),
    'non_verifies', (SELECT count(*) FROM public.profiles WHERE NOT COALESCE(is_verified, false))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_plan_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_plan_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_plan_counts() TO authenticated;

-- ------------------------------------------------------------
-- 4. Liste filtrée par offre
-- ------------------------------------------------------------
-- La pagination et la recherche se font EN BASE. Charger 100 profils puis
-- filtrer dans le navigateur donnerait le même défaut que la découverte :
-- chercher « Marie » ne parcourrait que les 100 déjà tirés.
CREATE OR REPLACE FUNCTION public.admin_users_by_plan(
  p_plan   text DEFAULT 'all',
  p_search text DEFAULT NULL,
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, first_name text, last_name text, city text, country text,
  gender text, is_verified boolean, is_founder boolean,
  public_plan text, premium_until timestamp with time zone,
  created_at timestamp with time zone, last_seen timestamp with time zone,
  photos text[], denomination text,
  total_paye integer, nb_paiements integer,
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_q   text := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;

  RETURN QUERY
  WITH filtres AS (
    SELECT p.*
    FROM public.profiles p
    WHERE (
      p_plan = 'all'
      OR (p_plan = 'gratuit' AND NOT p.is_founder
          AND (p.public_plan = 'gratuit' OR p.premium_until IS NULL OR p.premium_until <= v_now))
      OR (p_plan = 'premium' AND NOT p.is_founder
          AND p.public_plan = 'premium' AND p.premium_until > v_now)
      OR (p_plan = 'vip' AND (p.is_founder OR (p.public_plan = 'vip' AND p.premium_until > v_now)))
    )
    AND (
      v_q IS NULL
      OR p.first_name ILIKE '%' || v_q || '%'
      OR p.last_name  ILIKE '%' || v_q || '%'
      OR p.city       ILIKE '%' || v_q || '%'
      OR p.country    ILIKE '%' || v_q || '%'
    )
  )
  SELECT
    f.id, f.first_name, f.last_name, f.city, f.country,
    f.gender, f.is_verified, f.is_founder,
    f.public_plan, f.premium_until,
    f.created_at, f.last_seen,
    f.photos, f.denomination,
    COALESCE((SELECT sum(pay.amount_xof)::integer FROM public.payments pay
              WHERE pay.user_id = f.id AND pay.status = 'completed'), 0),
    COALESCE((SELECT count(*)::integer FROM public.payments pay
              WHERE pay.user_id = f.id AND pay.status = 'completed'), 0),
    (SELECT count(*) FROM filtres)
  FROM filtres f
  ORDER BY f.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_by_plan(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_users_by_plan(text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_users_by_plan(text, text, integer, integer) TO authenticated;

-- ------------------------------------------------------------
-- 5. La découverte renvoie aussi l'offre
-- ------------------------------------------------------------
-- Sans ces trois colonnes, la carte ne peut pas afficher de badge. Le
-- type de retour change : PostgreSQL impose alors un DROP, `CREATE OR
-- REPLACE` refusant toute modification de la signature de sortie.
DROP FUNCTION IF EXISTS public.discover_profiles(
  text, integer, integer, text[], text[], text[], text[], text[],
  integer, integer, integer, boolean, integer);

CREATE FUNCTION public.discover_profiles(
  p_country      text    DEFAULT NULL,
  p_age_min      integer DEFAULT NULL,
  p_age_max      integer DEFAULT NULL,
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
  distance_km double precision,
  public_plan text, premium_until timestamp with time zone, is_founder boolean
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
    END AS distance_km,
    t.public_plan, t.premium_until, t.is_founder
  FROM public.profiles t
  WHERE t.id <> v_user

    AND COALESCE(t.visibility, 'tous') <> 'pause'
    AND (
      COALESCE(t.visibility, 'tous') <> 'demande'
      OR EXISTS (
        SELECT 1 FROM public.swipes s
        WHERE s.swiper_id = t.id AND s.target_id = v_user
          AND s.action IN ('like', 'superlike')
      )
    )

    AND NOT EXISTS (
      SELECT 1 FROM public.swipes s WHERE s.swiper_id = v_user AND s.target_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_user AND b.blocked_id = t.id)
         OR (b.blocker_id = t.id AND b.blocked_id = v_user)
    )

    AND (v_seek IS NULL OR v_seek = 'all' OR t.gender = v_seek)

    AND (p_country IS NULL OR t.country = p_country)
    AND (p_age_min IS NULL OR t.birth_date IS NULL
         OR t.birth_date <= (current_date - make_interval(years => p_age_min)))
    AND (p_age_max IS NULL OR t.birth_date IS NULL
         OR t.birth_date >= (current_date - make_interval(years => p_age_max + 1)))

    AND (p_marital      IS NULL OR t.marital_status    = ANY(p_marital))
    AND (p_denomination IS NULL OR t.denomination      = ANY(p_denomination))
    AND (p_attendance   IS NULL OR t.church_attendance = ANY(p_attendance))
    AND (p_education    IS NULL OR t.education         = ANY(p_education))
    AND (p_intent       IS NULL OR t.marriage_intent   = ANY(p_intent))
    AND (p_height_min IS NULL OR t.height_cm >= p_height_min)
    AND (p_height_max IS NULL OR t.height_cm <= p_height_max)
    AND (p_verified IS NULL OR NOT p_verified OR COALESCE(t.is_verified, false))

    AND (
      p_max_km IS NULL
      OR (
        v_lat IS NOT NULL AND t.share_location
        AND public.distance_km(v_lat, v_lng, t.latitude, t.longitude) <= p_max_km
      )
    )

  ORDER BY
    (t.boosted_until IS NOT NULL AND t.boosted_until > timezone('utc'::text, now())) DESC,
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
-- 6. Contrôle
-- ------------------------------------------------------------
SELECT public.admin_plan_counts() AS repartition;

SELECT first_name, public_plan, premium_until, is_founder
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;
