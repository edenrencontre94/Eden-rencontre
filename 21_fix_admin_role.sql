-- ============================================================
-- 21_fix_admin_role.sql
-- ============================================================

-- 1. Voir la vraie structure de la table qui gère les rôles
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('staff_roles', 'team_members', 'admin_roles', 'roles', 'user_roles')
ORDER BY table_name, ordinal_position;

-- 2. Lister toutes les tables qui contiennent le mot "role" ou "staff" ou "team" ou "admin"
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%role%'
    OR table_name ILIKE '%staff%'
    OR table_name ILIKE '%team%'
    OR table_name ILIKE '%admin%'
    OR table_name ILIKE '%permission%'
  )
ORDER BY table_name;

-- 3. Voir le code source exact de is_staff()
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'is_staff'
  AND pronamespace = 'public'::regnamespace;
