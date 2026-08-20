-- ============================================================
-- DIAGNOSTIC — À coller dans Supabase SQL Editor
-- Ce fichier teste les tables et fonctions une par une pour
-- trouver ce qui empêche admin_analytics et admin_marketing
-- de fonctionner.
-- ============================================================

-- 1. Vérifie que la fonction is_staff() existe
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_staff';

-- 2. Vérifie que les fonctions admin existent
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('admin_analytics', 'admin_marketing');

-- 3. Vérifie les tables utilisées par ces fonctions
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'matches', 'messages', 'payments',
    'account_deletions', 'install_stats', 'campaigns',
    'push_subscriptions', 'email_suppressions'
  )
ORDER BY table_name;

-- 4. Test direct de admin_analytics (doit retourner du JSONB)
-- Si ça lève une erreur, Supabase l'affichera en rouge
SELECT public.admin_analytics(30);

-- 5. Test direct de admin_marketing
SELECT public.admin_marketing(30);
