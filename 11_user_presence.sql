-- ============================================================
-- Migration : Ajout de la présence utilisateur (En ligne / Dernier vu)
-- ============================================================

-- 1. Ajouter la colonne last_seen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 2. Créer une fonction RPC légère pour mettre à jour la présence de l'utilisateur
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen = timezone('utc'::text, now())
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
