-- ==============================================================================
-- 29_make_leo_admin.sql
-- Définit SEUL Leo comme administrateur et retire les droits aux autres.
-- À exécuter dans Supabase → SQL Editor
-- ==============================================================================

-- 1. On supprime le rôle admin pour TOUS les utilisateurs existants
DELETE FROM public.staff_roles;

-- 2. On ajoute/met à jour UNIQUEMENT Leo (a2d39d3f-00eb-460a-a9d8-ca5476aaf733)
INSERT INTO public.staff_roles (user_id, role, updated_at)
VALUES (
  'a2d39d3f-00eb-460a-a9d8-ca5476aaf733',
  'admin',
  now()
)
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin', updated_at = now();

-- Vérification : affiche la liste des admins (devrait n'y avoir que Léo)
SELECT user_id, role FROM public.staff_roles;
