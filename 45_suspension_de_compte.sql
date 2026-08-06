-- ============================================================
-- Suspension de compte
-- ============================================================
-- La seule sanction intermédiaire entre « ne rien faire » et « supprimer
-- définitivement ». Sans elle, la modération n'a que deux réponses : le
-- silence, ou l'irréversible.
--
-- Le menu « Suspendre » existait dans l'ancienne page d'administration
-- mais ne faisait STRICTEMENT RIEN — aucune colonne, aucun contrôle. Il a
-- été retiré plutôt que laissé mensonger ; le voici pour de bon.
--
-- Une suspension n'est pas une suppression : le compte, les conversations
-- et l'abonnement subsistent. Seul l'accès est gelé, et il se rouvre.

-- ------------------------------------------------------------
-- 1. Les colonnes
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  -- NULL = pas suspendu. Une DATE plutôt qu'un booléen : la suspension
  -- temporaire se lève alors toute seule, sans tâche planifiée ni risque
  -- d'oublier quelqu'un dehors indéfiniment.
  ADD COLUMN IF NOT EXISTS suspended_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_suspended_idx
ON public.profiles (suspended_until) WHERE suspended_until IS NOT NULL;

-- Historique : une suspension levée disparaîtrait sinon sans laisser de
-- trace, et un récidiviste passerait pour un primo-délinquant.
CREATE TABLE IF NOT EXISTS public.suspensions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  suspended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  days integer,                 -- NULL = durée indéterminée
  starts_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  ends_at timestamp with time zone,
  lifted_at timestamp with time zone,
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS suspensions_user_idx ON public.suspensions (user_id, starts_at DESC);

ALTER TABLE public.suspensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read suspensions" ON public.suspensions;
CREATE POLICY "Admins read suspensions"
ON public.suspensions FOR SELECT TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------
-- 2. Lecture
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_suspended(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND suspended_until IS NOT NULL
      AND suspended_until > timezone('utc'::text, now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO service_role;

-- Ce que l'application lit sur ELLE-MÊME. Sans paramètre, donc exposable :
-- impossible de sonder le statut d'autrui.
CREATE OR REPLACE FUNCTION public.my_suspension()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  p      record;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('suspended', false);
  END IF;

  SELECT suspended_until, suspension_reason INTO p
  FROM public.profiles WHERE id = v_user;

  IF p.suspended_until IS NULL OR p.suspended_until <= timezone('utc'::text, now()) THEN
    RETURN jsonb_build_object('suspended', false);
  END IF;

  -- Le MOTIF est communiqué au membre. Une suspension sans explication
  -- produit un ticket de support furieux et une réputation détestable ;
  -- avec le motif, une partie des cas se règle d'eux-mêmes.
  RETURN jsonb_build_object(
    'suspended', true,
    'until', p.suspended_until,
    'reason', p.suspension_reason,
    -- Une suspension de plus de dix ans est considérée comme définitive
    -- côté affichage : annoncer « jusqu'au 12/03/2126 » serait absurde.
    'permanent', p.suspended_until > timezone('utc'::text, now()) + interval '10 years'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_suspension() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_suspension() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_suspension() TO authenticated;

-- ------------------------------------------------------------
-- 3. Suspendre et lever
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_user_id uuid,
  p_reason text,
  p_days integer DEFAULT NULL   -- NULL = durée indéterminée
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_now   timestamp with time zone := timezone('utc'::text, now());
  v_fin   timestamp with time zone;
  v_role  text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_user_id = v_admin THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self');
  END IF;

  -- Un administrateur ne peut pas en suspendre un autre. Sans ce garde-fou,
  -- un compte compromis mettrait toute l'équipe dehors en trois clics.
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  IF v_role = 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'admin_cible');
  END IF;

  IF length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'motif');
  END IF;

  IF p_days IS NOT NULL AND (p_days < 1 OR p_days > 365) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duree');
  END IF;

  -- Durée indéterminée : on pose une échéance très lointaine plutôt qu'un
  -- NULL. Toutes les vérifications reposent alors sur une seule
  -- comparaison de dates, sans cas particulier à oublier quelque part.
  v_fin := CASE
    WHEN p_days IS NULL THEN v_now + interval '100 years'
    ELSE v_now + make_interval(days => p_days)
  END;

  UPDATE public.profiles SET
    suspended_until = v_fin,
    suspension_reason = trim(p_reason),
    suspended_at = v_now,
    suspended_by = v_admin,
    -- Le profil disparaît aussi de la découverte des autres : laisser un
    -- compte suspendu recevoir des likes serait une double peine, pour lui
    -- comme pour ceux qui l'aiment sans jamais recevoir de réponse.
    visibility = 'pause'
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'introuvable');
  END IF;

  INSERT INTO public.suspensions (user_id, suspended_by, reason, days, starts_at, ends_at)
  VALUES (p_user_id, v_admin, trim(p_reason), p_days, v_now, v_fin);

  RETURN jsonb_build_object('ok', true, 'until', v_fin, 'permanent', p_days IS NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_now   timestamp with time zone := timezone('utc'::text, now());
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE public.profiles SET
    suspended_until = NULL,
    suspension_reason = NULL,
    suspended_at = NULL,
    suspended_by = NULL,
    -- La visibilité repasse à « tous » : c'est ce qu'elle était avant la
    -- suspension dans l'immense majorité des cas, et un profil rétabli
    -- mais invisible donnerait l'impression d'une sanction maintenue.
    visibility = 'tous'
  WHERE id = p_user_id;

  UPDATE public.suspensions
  SET lifted_at = v_now, lifted_by = v_admin
  WHERE user_id = p_user_id AND lifted_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_unsuspend_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unsuspend_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend_user(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 4. Le compte suspendu ne peut plus agir
-- ------------------------------------------------------------
-- Bloquer l'interface ne suffit pas : la clé publique permet d'appeler
-- l'API directement. Le refus doit donc être en base, à chaque écriture.
CREATE OR REPLACE FUNCTION public.block_if_suspended()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
BEGIN
  -- La colonne portant l'auteur diffère selon la table.
  v_user := CASE TG_TABLE_NAME
    WHEN 'messages'        THEN NEW.sender_id
    WHEN 'swipes'          THEN NEW.swiper_id
    WHEN 'calls'           THEN NEW.caller_id
    WHEN 'community_posts' THEN NEW.user_id
    WHEN 'reports'         THEN NEW.reporter_id
    ELSE NULL
  END;

  IF v_user IS NOT NULL AND public.is_suspended(v_user) THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED'
      USING HINT = 'Votre compte est suspendu.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suspended_messages ON public.messages;
CREATE TRIGGER trg_suspended_messages
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.block_if_suspended();

DROP TRIGGER IF EXISTS trg_suspended_swipes ON public.swipes;
CREATE TRIGGER trg_suspended_swipes
BEFORE INSERT ON public.swipes
FOR EACH ROW EXECUTE FUNCTION public.block_if_suspended();

DROP TRIGGER IF EXISTS trg_suspended_calls ON public.calls;
CREATE TRIGGER trg_suspended_calls
BEFORE INSERT ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.block_if_suspended();

DROP TRIGGER IF EXISTS trg_suspended_posts ON public.community_posts;
CREATE TRIGGER trg_suspended_posts
BEFORE INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.block_if_suspended();

-- ------------------------------------------------------------
-- 5. Retiré de la découverte
-- ------------------------------------------------------------
-- `visibility = 'pause'` posé lors de la suspension l'écarte déjà, mais on
-- ne s'appuie pas dessus : le membre pourrait la remettre à « tous » depuis
-- l'accueil si jamais il gardait un accès. Le filtre est explicite.
CREATE OR REPLACE FUNCTION public.discover_profiles(
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
  v_now   timestamp with time zone := timezone('utc'::text, now());
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;

  v_level := public.effective_level(v_user);
  v_avance := v_level >= 1;

  SELECT p.seeking_gender, p.latitude, p.longitude
  INTO v_seek, v_lat, v_lng
  FROM public.profiles p WHERE p.id = v_user;

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

    -- Comptes suspendus : hors découverte
    AND (t.suspended_until IS NULL OR t.suspended_until <= v_now)

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
    (t.boosted_until IS NOT NULL AND t.boosted_until > v_now) DESC,
    CASE
      WHEN v_lat IS NULL OR NOT t.share_location THEN NULL
      ELSE public.distance_km(v_lat, v_lng, t.latitude, t.longitude)
    END ASC NULLS LAST,
    t.last_seen DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 200));
END;
$$;

-- ------------------------------------------------------------
-- 6. Le back-office voit et filtre les suspendus
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_plan_counts()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now     timestamp with time zone := timezone('utc'::text, now());
  v_total   integer;
  v_payants integer;
  v_ca      bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT count(*) INTO v_total FROM public.profiles;

  SELECT count(DISTINCT user_id), COALESCE(sum(amount_xof), 0)
  INTO v_payants, v_ca
  FROM public.payments WHERE status = 'completed';

  RETURN jsonb_build_object(
    'total', v_total,
    'gratuit', (SELECT count(*) FROM public.profiles
                WHERE NOT is_founder
                  AND (public_plan = 'gratuit' OR premium_until IS NULL OR premium_until <= v_now)),
    'premium', (SELECT count(*) FROM public.profiles
                WHERE NOT is_founder AND public_plan = 'premium' AND premium_until > v_now),
    'vip',     (SELECT count(*) FROM public.profiles
                WHERE is_founder OR (public_plan = 'vip' AND premium_until > v_now)),
    'fondateurs', (SELECT count(*) FROM public.profiles WHERE is_founder),
    'expires', (SELECT count(*) FROM public.profiles
                WHERE NOT is_founder AND public_plan <> 'gratuit'
                  AND premium_until IS NOT NULL AND premium_until <= v_now),
    'nouveaux_7j',  (SELECT count(*) FROM public.profiles
                     WHERE created_at >= v_now - interval '7 days'),
    'femmes',       (SELECT count(*) FROM public.profiles WHERE gender = 'female'),
    'hommes',       (SELECT count(*) FROM public.profiles WHERE gender = 'male'),
    'genre_absent', (SELECT count(*) FROM public.profiles
                     WHERE gender IS NULL OR gender NOT IN ('female', 'male')),
    'actifs_7j',    (SELECT count(*) FROM public.profiles
                     WHERE last_seen >= v_now - interval '7 days'),
    'actifs_30j',   (SELECT count(*) FROM public.profiles
                     WHERE last_seen >= v_now - interval '30 days'),
    'verifies',     (SELECT count(*) FROM public.profiles WHERE is_verified),
    'non_verifies', (SELECT count(*) FROM public.profiles WHERE NOT COALESCE(is_verified, false)),
    'payants', v_payants,
    'ca_total', v_ca,
    'revenu_par_payant', CASE WHEN v_payants > 0 THEN (v_ca / v_payants)::integer ELSE 0 END,
    'taux_conversion', CASE WHEN v_total > 0
                       THEN ROUND((v_payants::numeric / v_total) * 100, 1) ELSE 0 END,
    'expire_7j', (SELECT count(*) FROM public.profiles
                  WHERE NOT is_founder AND premium_until > v_now
                    AND premium_until <= v_now + interval '7 days'),
    'inactifs_30j', (SELECT count(*) FROM public.profiles
                     WHERE last_seen IS NULL OR last_seen < v_now - interval '30 days'),
    'signales',     (SELECT count(DISTINCT reported_id) FROM public.reports WHERE status = 'pending'),
    'en_pause',     (SELECT count(*) FROM public.profiles WHERE visibility = 'pause'),
    'suspendus',    (SELECT count(*) FROM public.profiles
                     WHERE suspended_until IS NOT NULL AND suspended_until > v_now)
  );
END;
$$;

-- La liste renvoie désormais l'échéance de suspension : le type de retour
-- change, donc DROP puis recréation.
DROP FUNCTION IF EXISTS public.admin_users_by_plan(
  text, text, integer, integer, text, text, text, boolean);

CREATE FUNCTION public.admin_users_by_plan(
  p_plan     text    DEFAULT 'all',
  p_search   text    DEFAULT NULL,
  p_limit    integer DEFAULT 50,
  p_offset   integer DEFAULT 0,
  p_segment  text    DEFAULT NULL,
  p_gender   text    DEFAULT NULL,
  p_country  text    DEFAULT NULL,
  p_verified boolean DEFAULT NULL
)
RETURNS TABLE (
  id uuid, first_name text, last_name text, city text, country text,
  gender text, is_verified boolean, is_founder boolean,
  public_plan text, premium_until timestamp with time zone,
  created_at timestamp with time zone, last_seen timestamp with time zone,
  photos text[], denomination text, visibility text,
  total_paye integer, nb_paiements integer,
  dernier_paiement timestamp with time zone, derniere_offre text,
  completion integer,
  nb_matchs integer, nb_messages integer,
  nb_likes_donnes integer, nb_likes_recus integer,
  nb_signalements integer, nb_blocages integer, nb_tickets integer,
  suspended_until timestamp with time zone, suspension_reason text,
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
    WHERE
      (
        p_plan = 'all'
        OR (p_plan = 'gratuit' AND NOT p.is_founder
            AND (p.public_plan = 'gratuit' OR p.premium_until IS NULL OR p.premium_until <= v_now))
        OR (p_plan = 'premium' AND NOT p.is_founder
            AND p.public_plan = 'premium' AND p.premium_until > v_now)
        OR (p_plan = 'vip' AND (p.is_founder OR (p.public_plan = 'vip' AND p.premium_until > v_now)))
      )
      AND (
        p_segment IS NULL
        OR (p_segment = 'inactifs'
            AND (p.last_seen IS NULL OR p.last_seen < v_now - interval '30 days'))
        OR (p_segment = 'incomplet' AND public.profile_completion(p.id) < 50)
        OR (p_segment = 'signales' AND EXISTS (
              SELECT 1 FROM public.reports r
              WHERE r.reported_id = p.id AND r.status = 'pending'))
        OR (p_segment = 'expire_bientot'
            AND NOT p.is_founder
            AND p.premium_until > v_now
            AND p.premium_until <= v_now + interval '7 days')
        OR (p_segment = 'jamais_swipe' AND NOT EXISTS (
              SELECT 1 FROM public.swipes s WHERE s.swiper_id = p.id))
        OR (p_segment = 'en_pause' AND p.visibility = 'pause')
        OR (p_segment = 'suspendus'
            AND p.suspended_until IS NOT NULL AND p.suspended_until > v_now)
      )
      AND (p_gender   IS NULL OR p.gender = p_gender)
      AND (p_country  IS NULL OR p.country = p_country)
      AND (p_verified IS NULL OR COALESCE(p.is_verified, false) = p_verified)
      AND (
        v_q IS NULL
        OR p.first_name ILIKE '%' || v_q || '%'
        OR p.last_name  ILIKE '%' || v_q || '%'
        OR p.city       ILIKE '%' || v_q || '%'
        OR p.country    ILIKE '%' || v_q || '%'
      )
  ),
  page AS (
    SELECT * FROM filtres ORDER BY created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    OFFSET GREATEST(0, COALESCE(p_offset, 0))
  )
  SELECT
    f.id, f.first_name, f.last_name, f.city, f.country,
    f.gender, f.is_verified, f.is_founder,
    f.public_plan, f.premium_until,
    f.created_at, f.last_seen,
    f.photos, f.denomination, COALESCE(f.visibility, 'tous'),

    COALESCE((SELECT sum(pay.amount_xof)::integer FROM public.payments pay
              WHERE pay.user_id = f.id AND pay.status = 'completed'), 0),
    COALESCE((SELECT count(*)::integer FROM public.payments pay
              WHERE pay.user_id = f.id AND pay.status = 'completed'), 0),
    (SELECT max(pay.completed_at) FROM public.payments pay
     WHERE pay.user_id = f.id AND pay.status = 'completed'),
    (SELECT pay.offer_id FROM public.payments pay
     WHERE pay.user_id = f.id AND pay.status = 'completed'
     ORDER BY pay.completed_at DESC LIMIT 1),

    public.profile_completion(f.id),

    COALESCE((SELECT count(*)::integer FROM public.matches m
              WHERE m.user1_id = f.id OR m.user2_id = f.id), 0),
    COALESCE((SELECT count(*)::integer FROM public.messages ms
              WHERE ms.sender_id = f.id), 0),
    COALESCE((SELECT count(*)::integer FROM public.swipes s
              WHERE s.swiper_id = f.id AND s.action IN ('like', 'superlike')), 0),
    COALESCE((SELECT count(*)::integer FROM public.swipes s
              WHERE s.target_id = f.id AND s.action IN ('like', 'superlike')), 0),

    COALESCE((SELECT count(*)::integer FROM public.reports r
              WHERE r.reported_id = f.id AND r.status = 'pending'), 0),
    COALESCE((SELECT count(*)::integer FROM public.blocks b
              WHERE b.blocked_id = f.id), 0),
    COALESCE((SELECT count(*)::integer FROM public.support_tickets t
              WHERE t.user_id = f.id AND t.status IN ('open', 'pending')), 0),

    f.suspended_until, f.suspension_reason,

    (SELECT count(*) FROM filtres)
  FROM page f
  ORDER BY f.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_by_plan(
  text, text, integer, integer, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_users_by_plan(
  text, text, integer, integer, text, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_users_by_plan(
  text, text, integer, integer, text, text, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 7. Contrôle
-- ------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE suspended_until > timezone('utc'::text, now())) AS suspendus,
  count(*) AS total
FROM public.profiles;

SELECT public.my_suspension() AS ma_situation;
