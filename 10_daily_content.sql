-- ============================================================
-- Migration : Ajout de la table pour les contenus quotidiens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_daily_content (
  date date PRIMARY KEY,
  verse_text text,
  verse_ref text,
  challenge_title text,
  challenge_text text,
  advice_text text,
  advice_source text,
  advice_ref text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activation RLS
ALTER TABLE public.app_daily_content ENABLE ROW LEVEL SECURITY;

-- Politique : Tout le monde peut lire le contenu du jour
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'daily_content_read_all' AND tablename = 'app_daily_content'
  ) THEN
    CREATE POLICY "daily_content_read_all"
      ON public.app_daily_content FOR SELECT
      USING (true);
  END IF;
END $$;

-- Insertion d'un exemple pour tester (optionnel)
-- Ligne commentée pour ne pas interférer avec le fallback en prod,
-- mais vous pouvez décommenter si besoin de tester la récupération via DB :
-- INSERT INTO public.app_daily_content (date, verse_text, verse_ref, challenge_title, challenge_text, advice_text, advice_source, advice_ref)
-- VALUES (CURRENT_DATE, 'Que tout ce que vous faites soit fait avec amour.', '1 Corinthiens 16:14', 'Défi d''exemple', 'Ceci est un défi ajouté en base', 'Conseil test', 'Auteur test', 'Test')
-- ON CONFLICT (date) DO NOTHING;
