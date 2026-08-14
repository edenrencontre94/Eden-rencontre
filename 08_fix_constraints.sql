-- ====================================================================
-- 08_fix_constraints.sql - Correction des contraintes de base
-- ====================================================================

-- 1. Correction de la contrainte 'gender' sur la table profiles
-- Le frontend envoie le genre en minuscules ("homme", "femme"), mais la 
-- base de données s'attendait strictement à des majuscules ("Homme", "Femme").
-- Nous assouplissons cette règle pour accepter les deux formats.

ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_gender_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_gender_check 
  CHECK (gender IN ('homme', 'femme', 'Homme', 'Femme'));

-- L'ajout de ce correctif règlera l'erreur : 
-- "new row for relation 'profiles' violates check constraint 'profiles_gender_check'"
