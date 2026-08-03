-- ============================================================
-- Migration : colonnes manquantes sur profiles (last_seen, is_verified)
-- ============================================================
-- Constat (vérifié via l'API REST) : ni `last_seen` ni `is_verified`
-- n'existent sur public.profiles. Or PostgREST rejette la requête ENTIÈRE
-- dès qu'une colonne demandée est absente — d'où tous les interlocuteurs
-- affichés en « Membre » sur la page Messages.
--
-- Cette migration est idempotente : elle peut être rejouée sans risque,
-- y compris si 11_user_presence.sql a déjà été appliqué.

-- 1. Présence utilisateur (contenu de 11_user_presence.sql, qui n'a jamais été exécuté)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone
DEFAULT timezone('utc'::text, now());

CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen = timezone('utc'::text, now())
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_last_seen() TO authenticated;

-- 2. Certification des profils
--    Utilisée par la page Messages (badge ✓) ET par l'admin :
--    admin.utilisateurs.tsx (bouton « Certifier ») et admin.index.tsx (KPI).
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- 3. Vérification : les deux colonnes doivent apparaître
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('last_seen', 'is_verified');
