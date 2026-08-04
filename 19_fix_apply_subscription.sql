-- ============================================================
-- Correctif : fonction apply_subscription_payment introuvable (404)
-- ============================================================
-- Après 18_abonnements_paiements.sql, les 3 tables existaient bien mais
-- l'appel RPC renvoyait 404. Deux causes possibles, traitées ici :
--
--   1. Dans ON CONFLICT DO UPDATE, la référence à la ligne existante doit
--      être NON qualifiée (`subscriptions.started_at`) et non pas
--      `public.subscriptions.started_at`, que Postgres refuse.
--   2. PostgREST met son schéma en cache : une fonction fraîchement créée
--      reste invisible tant qu'on ne lui demande pas de recharger.

DROP FUNCTION IF EXISTS public.apply_subscription_payment(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.apply_subscription_payment(
  p_user_id uuid,
  p_plan_id text,
  p_days integer
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
  v_new_end timestamp with time zone;
BEGIN
  IF p_plan_id NOT IN ('premium', 'vip') THEN
    RAISE EXCEPTION 'Plan invalide : %', p_plan_id;
  END IF;

  IF p_days IS NULL OR p_days <= 0 THEN
    RAISE EXCEPTION 'Durée invalide : %', p_days;
  END IF;

  SELECT expires_at INTO v_current
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  -- On prolonge depuis la fin en cours si elle est future, sinon depuis maintenant
  v_base := GREATEST(COALESCE(v_current, v_now), v_now);
  v_new_end := v_base + make_interval(days => p_days);

  INSERT INTO public.subscriptions AS s (user_id, plan_id, expires_at, started_at, updated_at)
  VALUES (p_user_id, p_plan_id, v_new_end, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET plan_id    = EXCLUDED.plan_id,
        expires_at = v_new_end,
        started_at = COALESCE(s.started_at, EXCLUDED.started_at),
        updated_at = v_now;

  RETURN v_new_end;
END;
$$;

-- Les Edge Functions passent par la service key ; on n'ouvre rien de plus.
REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_subscription_payment(uuid, text, integer) TO service_role;

-- Force PostgREST à relire le schéma, sinon la fonction reste en 404
NOTIFY pgrst, 'reload schema';

-- Contrôle : doit renvoyer une ligne
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'apply_subscription_payment';
