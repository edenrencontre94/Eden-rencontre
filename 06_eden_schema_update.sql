-- ====================================================================
-- 06_eden_schema_update.sql - Ajout des champs de profil manquants
-- ====================================================================

-- L'ancien schéma était trop basique. L'application envoie de nombreuses 
-- informations détaillées lors de l'onboarding. Nous les ajoutons ici.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS practice_level TEXT,
  ADD COLUMN IF NOT EXISTS baptized TEXT,
  ADD COLUMN IF NOT EXISTS church_attendance TEXT,
  ADD COLUMN IF NOT EXISTS seeking_gender TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS marriage_intent TEXT,
  ADD COLUMN IF NOT EXISTS has_children TEXT,
  ADD COLUMN IF NOT EXISTS wants_children TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
