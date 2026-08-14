-- =====================================================================================
-- 14_add_missing_profile_columns.sql
-- =====================================================================================
-- Ajoute les colonnes manquantes dans la table `profiles` nécessaires pour
-- sauvegarder toutes les informations du formulaire de profil complété.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qualities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flaws TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dealbreakers TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS looking_for TEXT,
  ADD COLUMN IF NOT EXISTS marriage_vision TEXT;
