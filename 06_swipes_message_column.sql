-- Ajouter la colonne "message" à la table swipes
-- (utilisée pour les messages pré-match envoyés depuis la page Découvrir)
ALTER TABLE public.swipes
ADD COLUMN IF NOT EXISTS message TEXT;
