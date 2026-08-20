-- ============================================================
-- 20_setup_admin.sql
-- Rend les pages /admin/analytics et /admin/marketing
-- fonctionnelles en production.
--
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ─── 1. S'assurer que la table staff_roles existe ────────────
CREATE TABLE IF NOT EXISTS public.staff_roles (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('member','redacteur','support','moderator','admin')),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Active la sécurité par ligne si ce n'est pas déjà fait
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

-- Politique : chaque staff ne voit que sa propre ligne
DROP POLICY IF EXISTS "staff_roles_select" ON public.staff_roles;
CREATE POLICY "staff_roles_select"
  ON public.staff_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── 2. S'assurer que is_staff() est à jour ──────────────────
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

-- ─── 3. Promouvoir ton compte en admin ───────────────────────
-- UUID du propriétaire du compte
INSERT INTO public.staff_roles (user_id, role, updated_at)
VALUES (
  'a2d39d3f-00eb-460a-a9d8-ca5476aaf733',
  'admin',
  now()
)
ON CONFLICT (user_id)
  DO UPDATE SET role = 'admin', updated_at = now();

-- ─── 4. Vérification ─────────────────────────────────────────
-- Doit retourner une ligne avec role = 'admin'
SELECT user_id, role, updated_at
FROM public.staff_roles
WHERE user_id = 'a2d39d3f-00eb-460a-a9d8-ca5476aaf733';
