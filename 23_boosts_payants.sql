-- ============================================================
-- Migration : Boosts achetables à l'unité
-- ============================================================
-- Le Boost inclus dans Premium dure 30 minutes, une fois par mois.
-- Ces Boosts-ci s'achètent séparément (24 h, 3 jours, 7 jours) et sont
-- ouverts à tous, y compris aux membres gratuits — pour beaucoup ce sera
-- la première dépense sur la plateforme.

-- ------------------------------------------------------------
-- 1. La table des paiements doit accepter le type « boost »
-- ------------------------------------------------------------
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_plan_id_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_plan_id_check
CHECK (plan_id IN ('premium', 'vip', 'boost'));

-- `days` porte déjà la durée pour les abonnements ; on ajoute les heures
-- pour les boosts, dont la plus courte dure moins d'une journée.
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS hours integer;

-- ------------------------------------------------------------
-- 2. Origine du boost — distinguer l'inclus de l'acheté
-- ------------------------------------------------------------
ALTER TABLE public.boosts
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'plan'
  CHECK (source IN ('plan', 'achat'));

-- ------------------------------------------------------------
-- 3. Application d'un Boost acheté
-- ------------------------------------------------------------
-- ATTENTION : cette fonction prend un user_id en paramètre, elle ne DOIT
-- donc jamais être exposée à `authenticated` — sinon n'importe qui pourrait
-- s'offrir un boost gratuitement. Seules les Edge Functions, qui passent par
-- la service key, l'appellent. (C'est exactement la faille rencontrée sur
-- apply_subscription_payment.)
CREATE OR REPLACE FUNCTION public.apply_boost_purchase(
  p_user_id uuid,
  p_hours integer
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now     timestamp with time zone := timezone('utc'::text, now());
  v_current timestamp with time zone;
  v_base    timestamp with time zone;
  v_end     timestamp with time zone;
BEGIN
  IF p_hours IS NULL OR p_hours <= 0 THEN
    RAISE EXCEPTION 'Durée de boost invalide : %', p_hours;
  END IF;

  SELECT boosted_until INTO v_current FROM public.profiles WHERE id = p_user_id;

  -- Un boost acheté pendant un boost actif PROLONGE, il n'écrase pas
  v_base := GREATEST(COALESCE(v_current, v_now), v_now);
  v_end := v_base + make_interval(hours => p_hours);

  INSERT INTO public.boosts (user_id, plan_id, started_at, expires_at, source)
  VALUES (p_user_id, 'achat', v_now, v_end, 'achat');

  UPDATE public.profiles SET boosted_until = v_end WHERE id = p_user_id;

  RETURN v_end;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_boost_purchase(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_boost_purchase(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.apply_boost_purchase(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_boost_purchase(uuid, integer) TO service_role;

-- ------------------------------------------------------------
-- 4. Les boosts achetés ne consomment pas le quota mensuel
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boosts_left()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_now    timestamp with time zone := timezone('utc'::text, now());
  v_plan   text := 'gratuit';
  v_quota  integer;
  v_used   integer;
  v_active timestamp with time zone;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('left', 0, 'quota', 0);
  END IF;

  SELECT s.plan_id INTO v_plan
  FROM public.subscriptions s
  WHERE s.user_id = v_user AND s.expires_at IS NOT NULL AND s.expires_at > v_now;

  v_plan := COALESCE(v_plan, 'gratuit');
  v_quota := CASE v_plan WHEN 'vip' THEN -1 WHEN 'premium' THEN 1 ELSE 0 END;

  -- Seuls les boosts issus de la formule entrent dans le décompte
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

-- Marquer les boosts déjà enregistrés comme issus de la formule
UPDATE public.boosts SET source = 'plan' WHERE source IS NULL;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 5. Contrôle
-- ------------------------------------------------------------
SELECT p.proname, p.prosecdef AS security_definer,
       coalesce(array_to_string(p.proacl, ' | '), '(défaut)') AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('apply_boost_purchase', 'boosts_left', 'start_boost');
