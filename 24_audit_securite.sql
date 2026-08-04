-- ============================================================
-- Audit de sécurité — fonctions SECURITY DEFINER
-- ============================================================
-- Une fonction SECURITY DEFINER s'exécute avec les droits de son
-- propriétaire et contourne donc la RLS. Deux cas de figure :
--
--   • Elle déduit l'utilisateur de auth.uid()  → exposable à `authenticated`
--   • Elle reçoit un user_id en PARAMÈTRE      → réservée au service_role,
--     sinon n'importe qui agit au nom de n'importe qui
--
-- La faille rencontrée sur apply_subscription_payment relevait du second cas.

-- ------------------------------------------------------------
-- 1. update_last_seen : nettoyage
-- ------------------------------------------------------------
-- Elle reste exécutable par `anon`. Ce n'est PAS une faille : son UPDATE
-- porte sur `WHERE id = auth.uid()`, qui vaut NULL pour un visiteur
-- anonyme — aucune ligne n'est touchée. On la referme malgré tout, pour
-- ne pas laisser une fonction inutilement ouverte.
REVOKE ALL ON FUNCTION public.update_last_seen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_last_seen() FROM anon;
GRANT EXECUTE ON FUNCTION public.update_last_seen() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 2. Revue complète — à lire attentivement
-- ------------------------------------------------------------
-- Pour CHAQUE ligne dont security_definer = true, vérifiez :
--   • si `arguments` contient un user_id → l'acl NE DOIT PAS mentionner
--     anon= ni authenticated=, uniquement service_role=
--   • sinon → authenticated= est acceptable, anon= ne l'est pas
--
-- Une acl à « (droits par défaut) » signifie exécutable par TOUT LE MONDE.
SELECT
  p.proname                                        AS fonction,
  pg_get_function_identity_arguments(p.oid)        AS arguments,
  p.prosecdef                                      AS security_definer,
  coalesce(array_to_string(p.proacl, E'\n'), '(droits par défaut — OUVERT À TOUS)') AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.prosecdef DESC, p.proname;

-- ------------------------------------------------------------
-- 3. Tables sans RLS — elles sont lisibles par tous
-- ------------------------------------------------------------
SELECT c.relname AS table_sans_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1;
