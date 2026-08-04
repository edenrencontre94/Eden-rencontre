-- ============================================================
-- CORRECTIF DE SÉCURITÉ — à exécuter en priorité
-- ============================================================
-- apply_subscription_payment() est SECURITY DEFINER : elle écrit dans
-- `subscriptions` en contournant la RLS. C'est voulu — mais elle était
-- exécutable par le rôle `anon`, dont la clé est PUBLIQUE (présente dans
-- le bundle JavaScript du site).
--
-- Conséquence : n'importe qui pouvait s'accorder un VIP illimité avec
--   POST /rest/v1/rpc/apply_subscription_payment
--   {"p_user_id":"<son id>","p_plan_id":"vip","p_days":3650}
--
-- Le REVOKE ... FROM PUBLIC de la migration 19 ne suffisait pas :
-- Supabase accorde EXECUTE DIRECTEMENT à anon et authenticated via ses
-- privilèges par défaut, et un REVOKE sur PUBLIC ne retire pas ces
-- droits nominatifs.

REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer) FROM authenticated;

-- Seules les Edge Functions, qui utilisent la service key, doivent l'appeler.
GRANT EXECUTE ON FUNCTION public.apply_subscription_payment(uuid, text, integer) TO service_role;

-- Même vérification pour update_last_seen : elle est aussi SECURITY DEFINER,
-- mais elle n'agit que sur auth.uid(), donc l'exposer à `authenticated` est
-- légitime. On retire simplement l'accès anonyme.
DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.update_last_seen() FROM anon';
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Contrôle : qui peut exécuter quoi ?
-- ------------------------------------------------------------
-- La colonne acl ne doit PLUS contenir anon= ni authenticated=
-- pour apply_subscription_payment.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef                                AS security_definer,
  coalesce(array_to_string(p.proacl, E'\n'), '(droits par défaut)') AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('apply_subscription_payment', 'update_last_seen');
