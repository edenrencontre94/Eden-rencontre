-- ==============================================================================
-- 33_master_admin_fix.sql
-- SCRIPT DE CORRECTION GLOBALE DES MENUS ADMIN
-- ==============================================================================

-- ─── 1. FORCER LE RÔLE ADMIN POUR TON COMPTE ─────────────────────────────────
INSERT INTO public.staff_roles (user_id, role)
VALUES ('a2d39d3f-00eb-460a-a9d8-ca5476aaf733', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- ─── 2. RECRÉER LA VÉRIFICATION DE STAFF (is_staff) ──────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
      AND role IN ('redacteur','support','moderator','admin')
  );
END;
$$;

-- ─── 3. RECRÉER LES STATS KPI DE BASE (admin_dashboard_stats) ────────────────
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
  
  BEGIN
    SELECT COUNT(*) INTO v_reports FROM public.reports WHERE status = 'pending';
  EXCEPTION WHEN OTHERS THEN
    v_reports := 0;
  END;

  SELECT COUNT(*) INTO v_active_subs    FROM public.profiles  WHERE premium_until > v_now;

  BEGIN
    SELECT COALESCE(SUM(amount_xof), 0) INTO v_revenue_total FROM public.payments WHERE status = 'completed';
    SELECT COALESCE(SUM(amount_xof), 0) INTO v_revenue_month FROM public.payments WHERE status = 'completed' AND completed_at >= v_month;
  EXCEPTION WHEN OTHERS THEN
    v_revenue_total := 0;
    v_revenue_month := 0;
  END;

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

-- ─── 4. RECRÉER LA VUE D'ENSEMBLE EXACTE (admin_overview) ────────────────────
DROP FUNCTION IF EXISTS public.admin_overview();
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_today TIMESTAMPTZ := date_trunc('day', v_now);
  v_yesterday TIMESTAMPTZ := v_today - INTERVAL '1 day';
  v_week TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_week_p TIMESTAMPTZ := v_now - INTERVAL '14 days';
  v_month TIMESTAMPTZ := v_now - INTERVAL '30 days';
  v_month_p TIMESTAMPTZ := v_now - INTERVAL '60 days';

  v_insc_jour INT; v_insc_hier INT;
  v_insc_semaine INT; v_insc_semaine_p INT;
  v_insc_mois INT; v_insc_mois_p INT;
  
  v_matchs_mois INT; v_matchs_mois_p INT;
  v_msgs_mois INT; v_msgs_mois_p INT;
BEGIN
  IF NOT public.is_staff() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*) INTO v_insc_jour FROM public.profiles WHERE created_at >= v_today;
  SELECT COUNT(*) INTO v_insc_hier FROM public.profiles WHERE created_at >= v_yesterday AND created_at < v_today;
  SELECT COUNT(*) INTO v_insc_semaine FROM public.profiles WHERE created_at >= v_week;
  SELECT COUNT(*) INTO v_insc_semaine_p FROM public.profiles WHERE created_at >= v_week_p AND created_at < v_week;
  SELECT COUNT(*) INTO v_insc_mois FROM public.profiles WHERE created_at >= v_month;
  SELECT COUNT(*) INTO v_insc_mois_p FROM public.profiles WHERE created_at >= v_month_p AND created_at < v_month;

  SELECT COUNT(*) INTO v_matchs_mois FROM public.matches WHERE created_at >= v_month;
  SELECT COUNT(*) INTO v_matchs_mois_p FROM public.matches WHERE created_at >= v_month_p AND created_at < v_month;

  SELECT COUNT(*) INTO v_msgs_mois FROM public.messages WHERE created_at >= v_month;
  SELECT COUNT(*) INTO v_msgs_mois_p FROM public.messages WHERE created_at >= v_month_p AND created_at < v_month;

  RETURN jsonb_build_object(
    'inscrits', jsonb_build_object(
      'jour', v_insc_jour, 'hier', v_insc_hier,
      'semaine', v_insc_semaine, 'semaine_p', v_insc_semaine_p,
      'mois', v_insc_mois, 'mois_p', v_insc_mois_p
    ),
    'matchs_periode', jsonb_build_object('mois', v_matchs_mois, 'mois_p', v_matchs_mois_p),
    'messages_periode', jsonb_build_object('mois', v_msgs_mois, 'mois_p', v_msgs_mois_p),
    'visites_jour', 0,
    'visites_hier', 0,
    'superlikes_jour', 0,
    'superlikes_hier', 0,
    'activite', '[]'::jsonb,
    'retention', 0,
    'retention_base', 0
  );
END;
$$;
