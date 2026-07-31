-- ================================================================
-- Fix RLS policy for profiles INSERT during onboarding
-- À exécuter dans Supabase SQL Editor
-- ================================================================

-- Supprimer l'ancienne politique d'insertion restrictive
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leur propre profil" ON public.profiles;

-- Recréer avec une politique qui accepte aussi les utilisateurs authentifiés
-- (même si le token vient d'être créé)
CREATE POLICY "Les utilisateurs peuvent insérer leur propre profil"
ON public.profiles FOR INSERT
WITH CHECK (
  auth.uid() = id
  OR auth.role() = 'authenticated'
);

-- Vérifier les politiques actives
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';
