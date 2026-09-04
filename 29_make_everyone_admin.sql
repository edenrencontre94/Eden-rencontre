-- ==============================================================================
-- 29_make_everyone_admin.sql
-- Donne le rôle 'admin' à tous les profils actuels de la base.
-- (Utile en développement/test quand on recrée souvent des comptes)
-- À exécuter dans Supabase → SQL Editor
-- ==============================================================================

INSERT INTO public.staff_roles (user_id, role, updated_at)
SELECT id, 'admin', now() FROM public.profiles
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin', updated_at = now();

-- Vérification : affiche le nombre d'admins
SELECT count(*) AS total_admins FROM public.staff_roles WHERE role = 'admin';
