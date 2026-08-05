-- ============================================================
-- Migration : membres fondateurs
-- ============================================================
-- Les restrictions Premium / VIP / Boost ne s'appliquent qu'aux comptes
-- créés À PARTIR DE MAINTENANT. Tous les membres déjà inscrits conservent
-- l'accès complet, à vie et sans payer.
--
-- Le choix d'un DRAPEAU explicite plutôt que d'une comparaison de dates est
-- délibéré : une date de bascule se compare à `created_at`, qui peut être
-- réécrit lors d'une réinscription ou d'une restauration de sauvegarde.
-- Le drapeau, lui, est posé une fois et ne bouge plus.

-- ------------------------------------------------------------
-- 1. Le drapeau
-- ------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_founder boolean NOT NULL DEFAULT false;

-- Tous les comptes EXISTANTS deviennent fondateurs.
-- Les comptes suivants héritent du DEFAULT false : la migration ne
-- s'exécutant qu'une fois, aucun nouvel inscrit ne sera marqué.
UPDATE public.profiles SET is_founder = true WHERE is_founder = false;

CREATE INDEX IF NOT EXISTS profiles_founder_idx
ON public.profiles (is_founder) WHERE is_founder;

-- ------------------------------------------------------------
-- 2. Formule effective d'un membre
-- ------------------------------------------------------------
-- Source unique de vérité, utilisée par les boosts ET par l'application.
-- Un fondateur est traité comme VIP sans jamais avoir payé.
CREATE OR REPLACE FUNCTION public.effective_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now     timestamp with time zone := timezone('utc'::text, now());
  v_founder boolean := false;
  v_plan    text;
BEGIN
  IF p_user_id IS NULL THEN RETURN 'gratuit'; END IF;

  SELECT is_founder INTO v_founder FROM public.profiles WHERE id = p_user_id;
  IF COALESCE(v_founder, false) THEN RETURN 'vip'; END IF;

  SELECT s.plan_id INTO v_plan
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.expires_at IS NOT NULL
    AND s.expires_at > v_now;

  RETURN COALESCE(v_plan, 'gratuit');
END;
$$;

-- Elle prend un user_id : réservée au service_role et aux fonctions internes.
REVOKE ALL ON FUNCTION public.effective_plan(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.effective_plan(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.effective_plan(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid) TO service_role;

-- ------------------------------------------------------------
-- 3. Ce que l'application lit — sans paramètre, donc exposable
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
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('plan', 'gratuit', 'expires_at', NULL, 'is_founder', false);
  END IF;

  SELECT is_founder INTO v_founder FROM public.profiles WHERE id = v_user;
  v_founder := COALESCE(v_founder, false);

  SELECT s.plan_id, s.expires_at INTO v_plan, v_expires
  FROM public.subscriptions s
  WHERE s.user_id = v_user AND s.expires_at IS NOT NULL AND s.expires_at > v_now;

  RETURN jsonb_build_object(
    -- Un fondateur reste VIP même si un abonnement payé expire
    'plan', CASE WHEN v_founder THEN 'vip' ELSE COALESCE(v_plan, 'gratuit') END,
    'expires_at', CASE WHEN v_founder THEN NULL ELSE v_expires END,
    'is_founder', v_founder
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_entitlements() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_entitlements() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_entitlements() TO authenticated;

-- ------------------------------------------------------------
-- 4. Les Boosts suivent la formule effective
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
  v_plan     text;
  v_expires  timestamp with time zone;
  v_quota    integer;
  v_used     integer;
  v_active   timestamp with time zone;
  v_duration interval := interval '30 minutes';
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  v_plan := public.effective_plan(v_user);
  v_quota := CASE v_plan WHEN 'vip' THEN -1 WHEN 'premium' THEN 1 ELSE 0 END;

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
    WHERE b.user_id = v_user
      AND b.source = 'plan'
      AND b.started_at >= date_trunc('month', v_now);

    IF v_used >= v_quota THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'quota', 'used', v_used, 'quota', v_quota);
    END IF;
  END IF;

  v_expires := v_now + v_duration;

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
  v_plan   text;
  v_quota  integer;
  v_used   integer;
  v_active timestamp with time zone;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('left', 0, 'quota', 0, 'plan', 'gratuit');
  END IF;

  v_plan := public.effective_plan(v_user);
  v_quota := CASE v_plan WHEN 'vip' THEN -1 WHEN 'premium' THEN 1 ELSE 0 END;

  SELECT count(*) INTO v_used
  FROM public.boosts b
  WHERE b.user_id = v_user
    AND b.source = 'plan'
    AND b.started_at >= date_trunc('month', v_now);

  SELECT p.boosted_until INTO v_active FROM public.profiles p WHERE p.id = v_user;

  RETURN jsonb_build_object(
    'left', CASE WHEN v_quota = -1 THEN -1 ELSE GREATEST(0, v_quota - v_used) END,
    'quota', v_quota,
    'plan', v_plan,
    'active_until', CASE WHEN v_active > v_now THEN v_active ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.boosts_left() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.boosts_left() FROM anon;
GRANT EXECUTE ON FUNCTION public.boosts_left() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 5. Contrôle : combien de fondateurs, combien de nouveaux ?
-- ------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE is_founder)       AS fondateurs,
  count(*) FILTER (WHERE NOT is_founder)   AS soumis_au_paiement,
  count(*)                                 AS total
FROM public.profiles;
