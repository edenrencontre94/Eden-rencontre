-- ==============================================================================
-- 28_admin_dashboard_stats_rpc.sql
-- Fonction RPC sécurisée pour le tableau de bord administrateur.
-- SECURITY DEFINER = s'exécute avec les droits du propriétaire de la fonction
-- (service_role), donc bypass complet du RLS.
-- À exécuter dans Supabase → SQL Editor
-- ==============================================================================

DROP FUNCTION IF EXISTS public.admin_dashboard_stats();

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now         TIMESTAMPTZ := now();
  v_today       TIMESTAMPTZ := date_trunc('day', v_now);
  v_week        TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_month       TIMESTAMPTZ := v_now - INTERVAL '30 days';
  v_prev_month  TIMESTAMPTZ := v_now - INTERVAL '60 days';

  v_total         BIGINT;
  v_today_count   BIGINT;
  v_week_count    BIGINT;
  v_month_count   BIGINT;
  v_prev_count    BIGINT;
  v_verified      BIGINT;
  v_male          BIGINT;
  v_female        BIGINT;
  v_matches       BIGINT;
  v_messages      BIGINT;
  v_reports       BIGINT;
  v_revenue_total BIGINT;
  v_revenue_month BIGINT;
  v_active_subs   BIGINT;
BEGIN
  -- Vérifier que l'appelant est admin
  IF NOT public.is_staff() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*) INTO v_total          FROM public.profiles;
  SELECT COUNT(*) INTO v_today_count    FROM public.profiles WHERE created_at >= v_today;
  SELECT COUNT(*) INTO v_week_count     FROM public.profiles WHERE created_at >= v_week;
  SELECT COUNT(*) INTO v_month_count    FROM public.profiles WHERE created_at >= v_month;
  SELECT COUNT(*) INTO v_prev_count     FROM public.profiles WHERE created_at >= v_prev_month AND created_at < v_month;
  SELECT COUNT(*) INTO v_verified       FROM public.profiles WHERE is_verified = true;
  SELECT COUNT(*) INTO v_male           FROM public.profiles WHERE gender = 'male';
  SELECT COUNT(*) INTO v_female         FROM public.profiles WHERE gender = 'female';
  SELECT COUNT(*) INTO v_matches        FROM public.matches;
  SELECT COUNT(*) INTO v_messages       FROM public.messages;
  SELECT COUNT(*) INTO v_reports        FROM public.reports   WHERE status = 'pending';
  SELECT COUNT(*) INTO v_active_subs    FROM public.profiles  WHERE premium_until > v_now;

  SELECT COALESCE(SUM(amount_xof), 0) INTO v_revenue_total FROM public.payments WHERE status = 'completed';
  SELECT COALESCE(SUM(amount_xof), 0) INTO v_revenue_month FROM public.payments WHERE status = 'completed' AND completed_at >= v_month;

  RETURN jsonb_build_object(
    'totalUsers',        v_total,
    'newUsersToday',     v_today_count,
    'newUsersThisWeek',  v_week_count,
    'newUsersThisMonth', v_month_count,
    'prevMonthUsers',    v_prev_count,
    'verifiedUsers',     v_verified,
    'maleUsers',         v_male,
    'femaleUsers',       v_female,
    'totalMatches',      v_matches,
    'totalMessages',     v_messages,
    'openReports',       v_reports,
    'activeSubs',        v_active_subs,
    'revenueTotal',      v_revenue_total,
    'revenueMonth',      v_revenue_month
  );
END;
$$;

-- Vérification : doit retourner les vraies valeurs
SELECT public.admin_dashboard_stats();
