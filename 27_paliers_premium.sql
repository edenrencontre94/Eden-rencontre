-- ============================================================
-- Migration : paliers Premium et réserve VIP
-- ============================================================
-- Les droits Premium dépendent désormais de la DURÉE achetée :
--   niveau 1 = 15 jours · niveau 2 = 1 mois · niveau 3 = 3 mois
--
--                    Gratuit   P1     P2     P3     VIP
--   Messages/jour       5      20     35     55      ∞
--   Boosts/mois         0       1      2      4      ∞
--   Appel audio         ✗       ✓      ✓      ✓      ✓
--   Appel vidéo         ✗       ✗      ✗      ✗      ✓
--   Vidéo en message    ✗       ✗      ✗      ✗      ✓
--   Photo communauté    ✗       ✓      ✓      ✓      ✓
--   Vidéo communauté    ✗       ✗      ✗      ✗      ✓
--
-- Les membres fondateurs sont traités comme VIP.

-- ------------------------------------------------------------
-- 1. Le palier
-- ------------------------------------------------------------
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS premium_level smallint NOT NULL DEFAULT 1
  CHECK (premium_level BETWEEN 1 AND 3);

-- ------------------------------------------------------------
-- 2. Palier effectif — 4 pour VIP et fondateurs
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.effective_level(p_user_id uuid)
RETURNS smallint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text;
  v_level smallint;
BEGIN
  v_plan := public.effective_plan(p_user_id);
  IF v_plan = 'vip' THEN RETURN 4; END IF;
  IF v_plan = 'gratuit' THEN RETURN 0; END IF;

  SELECT s.premium_level INTO v_level
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.expires_at > timezone('utc'::text, now());

  RETURN COALESCE(v_level, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.effective_level(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.effective_level(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.effective_level(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.effective_level(uuid) TO service_role;

-- Quotas dérivés du palier — une seule définition, réutilisée partout
CREATE OR REPLACE FUNCTION public.quota_messages(p_level smallint)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_level WHEN 0 THEN 5 WHEN 1 THEN 20 WHEN 2 THEN 35 WHEN 3 THEN 55 ELSE -1 END;
$$;

CREATE OR REPLACE FUNCTION public.quota_boosts(p_level smallint)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_level WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 4 ELSE -1 END;
$$;

-- ------------------------------------------------------------
-- 3. Créditer un paiement en retenant le palier le plus élevé
-- ------------------------------------------------------------
-- Acheter 15 jours quand on a déjà 3 mois actifs ne doit pas rétrograder.
CREATE OR REPLACE FUNCTION public.apply_subscription_payment(
  p_user_id uuid,
  p_plan_id text,
  p_days integer,
  p_level smallint DEFAULT 1
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now     timestamp with time zone := timezone('utc'::text, now());
  v_current timestamp with time zone;
  v_level   smallint;
  v_base    timestamp with time zone;
  v_new_end timestamp with time zone;
BEGIN
  IF p_plan_id NOT IN ('premium', 'vip') THEN
    RAISE EXCEPTION 'Plan invalide : %', p_plan_id;
  END IF;
  IF p_days IS NULL OR p_days <= 0 THEN
    RAISE EXCEPTION 'Durée invalide : %', p_days;
  END IF;

  SELECT expires_at, premium_level INTO v_current, v_level
  FROM public.subscriptions WHERE user_id = p_user_id;

  v_base := GREATEST(COALESCE(v_current, v_now), v_now);
  v_new_end := v_base + make_interval(days => p_days);

  -- On garde le meilleur palier tant que la période court
  v_level := CASE
    WHEN v_current IS NULL OR v_current <= v_now THEN p_level
    ELSE GREATEST(COALESCE(v_level, 1), p_level)
  END;

  INSERT INTO public.subscriptions AS s
    (user_id, plan_id, premium_level, expires_at, started_at, updated_at)
  VALUES (p_user_id, p_plan_id, v_level, v_new_end, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET plan_id       = EXCLUDED.plan_id,
        premium_level = EXCLUDED.premium_level,
        expires_at    = v_new_end,
        started_at    = COALESCE(s.started_at, EXCLUDED.started_at),
        updated_at    = v_now;

  RETURN v_new_end;
END;
$$;

-- L'ancienne signature à 3 arguments (migrations 19/20) doit disparaître :
-- elle ne connaît pas premium_level et laisserait donc le palier au défaut.
-- Deux surcharges cohabitant, un appel à 3 arguments passerait silencieusement
-- par la mauvaise — et un abonné 3 mois se retrouverait au palier 1.
DROP FUNCTION IF EXISTS public.apply_subscription_payment(uuid, text, integer);

REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer, smallint) FROM anon;
REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer, smallint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_payment(uuid, text, integer, smallint) TO service_role;

-- ------------------------------------------------------------
-- 4. Ce que l'application lit
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_entitlements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_now     timestamp with time zone := timezone('utc'::text, now());
  v_founder boolean := false;
  v_plan    text;
  v_expires timestamp with time zone;
  v_level   smallint;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('plan', 'gratuit', 'level', 0, 'expires_at', NULL, 'is_founder', false);
  END IF;

  SELECT is_founder INTO v_founder FROM public.profiles WHERE id = v_user;
  v_founder := COALESCE(v_founder, false);

  SELECT s.plan_id, s.expires_at, s.premium_level INTO v_plan, v_expires, v_level
  FROM public.subscriptions s
  WHERE s.user_id = v_user AND s.expires_at IS NOT NULL AND s.expires_at > v_now;

  IF v_founder THEN
    RETURN jsonb_build_object('plan', 'vip', 'level', 4, 'expires_at', NULL, 'is_founder', true);
  END IF;

  RETURN jsonb_build_object(
    'plan', COALESCE(v_plan, 'gratuit'),
    'level', CASE
      WHEN v_plan = 'vip' THEN 4
      WHEN v_plan = 'premium' THEN COALESCE(v_level, 1)
      ELSE 0
    END,
    'expires_at', v_expires,
    'is_founder', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_entitlements() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_entitlements() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_entitlements() TO authenticated;

-- ------------------------------------------------------------
-- 5. Messages : quota par palier, vidéo réservée au VIP
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_message_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level smallint;
  v_quota integer;
  v_sent  integer;
BEGIN
  v_level := public.effective_level(NEW.sender_id);

  -- Vocal : interdit au gratuit seulement
  IF NEW.media_type = 'audio' AND v_level = 0 THEN
    RAISE EXCEPTION 'FREE_NO_VOICE'
      USING HINT = 'Les messages vocaux sont réservés aux membres Premium et VIP.';
  END IF;

  -- Vidéo : réservée au VIP
  IF NEW.media_type = 'video' AND v_level < 4 THEN
    RAISE EXCEPTION 'VIP_ONLY_VIDEO_MESSAGE'
      USING HINT = 'L''envoi de vidéos en conversation est réservé aux membres VIP.';
  END IF;

  v_quota := public.quota_messages(v_level);
  IF v_quota = -1 THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_sent
  FROM public.messages m
  WHERE m.sender_id = NEW.sender_id
    AND m.created_at >= date_trunc('day', timezone('utc'::text, now()));

  IF v_sent >= v_quota THEN
    RAISE EXCEPTION 'MESSAGE_QUOTA_REACHED'
      USING HINT = 'Quota de messages quotidiens atteint.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 6. Appels : audio dès Premium, vidéo réservée au VIP
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_call_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level smallint;
BEGIN
  v_level := public.effective_level(NEW.caller_id);

  IF v_level = 0 THEN
    RAISE EXCEPTION 'FREE_NO_CALLS'
      USING HINT = 'Les appels sont réservés aux membres Premium et VIP.';
  END IF;

  IF NEW.call_type = 'video' AND v_level < 4 THEN
    RAISE EXCEPTION 'VIP_ONLY_VIDEO_CALL'
      USING HINT = 'Les appels vidéo sont réservés aux membres VIP.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 7. Communauté : photo dès Premium, vidéo réservée au VIP
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_community_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level smallint;
BEGIN
  v_level := public.effective_level(NEW.user_id);

  IF COALESCE(NEW.image_url, '') <> '' AND v_level = 0 THEN
    RAISE EXCEPTION 'FREE_NO_MEDIA_POST'
      USING HINT = 'Les publications avec photo sont réservées aux membres Premium et VIP.';
  END IF;

  IF COALESCE(NEW.video_url, '') <> '' AND v_level < 4 THEN
    RAISE EXCEPTION 'VIP_ONLY_VIDEO_POST'
      USING HINT = 'Les publications vidéo sont réservées aux membres VIP.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 8. Boosts : quota par palier
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_boost()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_now      timestamp with time zone := timezone('utc'::text, now());
  v_level    smallint;
  v_plan     text;
  v_quota    integer;
  v_used     integer;
  v_active   timestamp with time zone;
  v_expires  timestamp with time zone;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  v_plan := public.effective_plan(v_user);
  v_level := public.effective_level(v_user);
  v_quota := public.quota_boosts(v_level);

  IF v_quota = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan', 'plan', v_plan);
  END IF;

  SELECT p.boosted_until INTO v_active FROM public.profiles p WHERE p.id = v_user;
  IF v_active IS NOT NULL AND v_active > v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'expires_at', v_active);
  END IF;

  IF v_quota > 0 THEN
    SELECT count(*) INTO v_used
    FROM public.boosts b
    WHERE b.user_id = v_user AND b.source = 'plan'
      AND b.started_at >= date_trunc('month', v_now);

    IF v_used >= v_quota THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'quota', 'used', v_used, 'quota', v_quota);
    END IF;
  END IF;

  v_expires := v_now + interval '30 minutes';

  INSERT INTO public.boosts (user_id, plan_id, started_at, expires_at, source)
  VALUES (v_user, v_plan, v_now, v_expires, 'plan');

  UPDATE public.profiles SET boosted_until = v_expires WHERE id = v_user;

  RETURN jsonb_build_object('ok', true, 'expires_at', v_expires, 'plan', v_plan);
END;
$$;

REVOKE ALL ON FUNCTION public.start_boost() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_boost() FROM anon;
GRANT EXECUTE ON FUNCTION public.start_boost() TO authenticated;

CREATE OR REPLACE FUNCTION public.boosts_left()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_now    timestamp with time zone := timezone('utc'::text, now());
  v_level  smallint;
  v_quota  integer;
  v_used   integer;
  v_active timestamp with time zone;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('left', 0, 'quota', 0, 'plan', 'gratuit');
  END IF;

  v_level := public.effective_level(v_user);
  v_quota := public.quota_boosts(v_level);

  SELECT count(*) INTO v_used
  FROM public.boosts b
  WHERE b.user_id = v_user AND b.source = 'plan'
    AND b.started_at >= date_trunc('month', v_now);

  SELECT p.boosted_until INTO v_active FROM public.profiles p WHERE p.id = v_user;

  RETURN jsonb_build_object(
    'left', CASE WHEN v_quota = -1 THEN -1 ELSE GREATEST(0, v_quota - v_used) END,
    'quota', v_quota,
    'plan', public.effective_plan(v_user),
    'level', v_level,
    'active_until', CASE WHEN v_active > v_now THEN v_active ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.boosts_left() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.boosts_left() FROM anon;
GRANT EXECUTE ON FUNCTION public.boosts_left() TO authenticated;

-- ------------------------------------------------------------
-- 9. Compteurs affichés
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_quotas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_now      timestamp with time zone := timezone('utc'::text, now());
  v_level    smallint;
  v_quota    integer;
  v_messages integer;
  v_likes    integer;
  v_last_sl  timestamp with time zone;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('plan', 'gratuit', 'level', 0); END IF;

  v_level := public.effective_level(v_user);
  v_quota := public.quota_messages(v_level);

  SELECT count(*) INTO v_messages
  FROM public.messages m
  WHERE m.sender_id = v_user AND m.created_at >= date_trunc('day', v_now);

  SELECT count(*) INTO v_likes
  FROM public.swipes s
  WHERE s.swiper_id = v_user AND s.action = 'like' AND s.created_at >= date_trunc('day', v_now);

  SELECT max(s.created_at) INTO v_last_sl
  FROM public.swipes s
  WHERE s.swiper_id = v_user AND s.action = 'superlike';

  RETURN jsonb_build_object(
    'plan', public.effective_plan(v_user),
    'level', v_level,
    'messages_left', CASE WHEN v_quota = -1 THEN -1 ELSE GREATEST(0, v_quota - v_messages) END,
    'messages_quota', v_quota,
    'likes_left', CASE WHEN v_level = 0 THEN GREATEST(0, 25 - v_likes) ELSE -1 END,
    'superlike_available_at',
      CASE WHEN v_level > 0 OR v_last_sl IS NULL OR v_last_sl <= v_now - interval '7 days'
           THEN NULL ELSE v_last_sl + interval '7 days' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_quotas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_quotas() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_quotas() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 10. Contrôle
-- ------------------------------------------------------------
-- generate_series renvoie des integer : le cast est obligatoire, Postgres
-- ne convertit pas implicitement vers smallint pour résoudre une fonction.
SELECT lvl AS palier,
       public.quota_messages(lvl::smallint) AS messages_par_jour,
       public.quota_boosts(lvl::smallint)   AS boosts_par_mois
FROM generate_series(0, 4) AS lvl;
