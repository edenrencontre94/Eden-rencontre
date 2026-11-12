-- ==============================================================================
-- 41_fix_premium_activation_and_revenue.sql
-- Correction complète du système de paiement Chariow :
--   1. completed_at non-nullable avec valeur par défaut → apparaît dans revenueMonth
--   2. my_entitlements retourne le bon level selon le palier d'abonnement
--   3. admin_dashboard_stats: fallback sur created_at si completed_at est NULL
--   4. trigger auto-activation Premium à chaque INSERT dans payments
--   5. Correction des lignes existantes avec completed_at NULL
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Corriger les paiements existants avec completed_at NULL
--    (ils n'apparaissaient pas dans "Encaissé ces 30 derniers jours")
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE public.payments
SET completed_at = COALESCE(completed_at, created_at, now())
WHERE status = 'completed'
  AND completed_at IS NULL;

-- S'assurer que completed_at a une valeur par défaut solide
ALTER TABLE public.payments
  ALTER COLUMN completed_at SET DEFAULT now();

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Trigger : activation automatique du Premium à chaque paiement complété
--    Ce trigger garantit que même si le webhook échoue, un paiement enregistré
--    manuellement ou via reconcile active immédiatement l'accès.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_premium_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days       INT;
  v_base       TIMESTAMPTZ;
  v_new_until  TIMESTAMPTZ;
BEGIN
  -- Seulement pour les paiements complétés
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- Déterminer la durée selon l'offre
  v_days := CASE
    WHEN NEW.offer_id LIKE '%15j%' OR NEW.offer_id LIKE '%15d%' THEN 15
    WHEN NEW.offer_id LIKE '%3m%' OR NEW.offer_id LIKE '%90%'   THEN 90
    ELSE 30  -- premium_1m par défaut
  END;

  -- Prolonger depuis maintenant ou depuis l'expiration en cours
  SELECT COALESCE(
    CASE WHEN premium_until > now() THEN premium_until ELSE now() END,
    now()
  )
  INTO v_base
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_new_until := v_base + (v_days || ' days')::INTERVAL;

  -- Activer le premium
  UPDATE public.profiles
  SET
    public_plan   = 'premium',
    premium_until = v_new_until,
    updated_at    = now()
  WHERE id = NEW.user_id;

  -- S'assurer que completed_at est renseigné
  IF NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Supprimer l'ancien trigger si existant
DROP TRIGGER IF EXISTS trg_activate_premium_on_payment ON public.payments;

-- Créer le trigger sur INSERT et UPDATE
CREATE TRIGGER trg_activate_premium_on_payment
  BEFORE INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_premium_on_payment();

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Corriger my_entitlements : retourner le bon level selon le palier
--    Level 1 = Premium 15j · Level 2 = Premium 1 mois · Level 3 = Premium 3 mois
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_entitlements()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p          RECORD;
  plan_id    TEXT;
  lvl        INT;
  last_offer TEXT;
BEGIN
  SELECT public_plan, premium_until, is_founder
  INTO p
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('plan', 'gratuit', 'level', 0, 'expires_at', null, 'is_founder', false);
  END IF;

  IF p.is_founder THEN
    -- Fondateur : accès Premium à vie, level 2 (1 mois équivalent)
    plan_id := 'premium';
    lvl := 2;

  ELSIF p.public_plan = 'premium' AND (p.premium_until IS NULL OR p.premium_until > now()) THEN
    -- Abonnement actif : déterminer le niveau depuis le dernier paiement
    SELECT offer_id INTO last_offer
    FROM public.payments
    WHERE user_id = auth.uid()
      AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

    lvl := CASE
      WHEN last_offer LIKE '%15j%' OR last_offer LIKE '%15d%' THEN 1
      WHEN last_offer LIKE '%3m%'  OR last_offer LIKE '%90%'  THEN 3
      ELSE 2  -- premium_1m ou inconnu → niveau 2 par défaut
    END;

    plan_id := 'premium';

  ELSE
    plan_id := 'gratuit';
    lvl := 0;
  END IF;

  RETURN json_build_object(
    'plan',       plan_id,
    'level',      lvl,
    'expires_at', p.premium_until,
    'is_founder', COALESCE(p.is_founder, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_entitlements() TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Corriger admin_dashboard_stats : fallback sur created_at si completed_at NULL
--    + Correction du calcul revenueMonth (utilise maintenant les deux colonnes)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now          TIMESTAMPTZ := now();
  v_today        TIMESTAMPTZ := date_trunc('day', v_now);
  v_week         TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_month        TIMESTAMPTZ := v_now - INTERVAL '30 days';
  v_prev_month   TIMESTAMPTZ := v_now - INTERVAL '60 days';

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
  v_revenue_total NUMERIC;
  v_revenue_month NUMERIC;
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
  SELECT COUNT(*) INTO v_reports        FROM public.reports WHERE status = 'pending';
  SELECT COUNT(*) INTO v_active_subs    FROM public.profiles WHERE premium_until > v_now;

  -- Total cumulé : tous les paiements complétés
  SELECT COALESCE(SUM(amount_xof), 0)
  INTO v_revenue_total
  FROM public.payments
  WHERE status = 'completed';

  -- Ces 30 derniers jours : utilise COALESCE(completed_at, created_at)
  -- pour ne pas rater les anciens paiements avec completed_at NULL
  SELECT COALESCE(SUM(amount_xof), 0)
  INTO v_revenue_month
  FROM public.payments
  WHERE status = 'completed'
    AND COALESCE(completed_at, created_at) >= v_month;

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

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Vérification finale : diagnostiquer l'état actuel
-- ──────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_payments_total     BIGINT;
  v_payments_completed BIGINT;
  v_payments_null_date BIGINT;
  v_active_premiums    BIGINT;
  v_revenue_30d        NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_payments_total     FROM public.payments;
  SELECT COUNT(*) INTO v_payments_completed FROM public.payments WHERE status = 'completed';
  SELECT COUNT(*) INTO v_payments_null_date FROM public.payments WHERE status = 'completed' AND completed_at IS NULL;
  SELECT COUNT(*) INTO v_active_premiums    FROM public.profiles WHERE premium_until > now();
  SELECT COALESCE(SUM(amount_xof), 0) INTO v_revenue_30d
  FROM public.payments
  WHERE status = 'completed'
    AND COALESCE(completed_at, created_at) >= now() - INTERVAL '30 days';

  RAISE NOTICE '============ DIAGNOSTIC PAIEMENTS ============';
  RAISE NOTICE 'Total paiements        : %', v_payments_total;
  RAISE NOTICE 'Paiements complétés    : %', v_payments_completed;
  RAISE NOTICE 'Avec completed_at NULL : % (corrigés par cette migration)', v_payments_null_date;
  RAISE NOTICE 'Abonnés premium actifs : %', v_active_premiums;
  RAISE NOTICE 'Revenus 30 derniers j  : % FCFA', v_revenue_30d;
  RAISE NOTICE '===============================================';
END $$;

