-- ============================================================
-- Migration : refus persistant des likes reçus
-- ============================================================
-- « Refuser » ne faisait que retirer la carte de l'état React :
-- au rechargement de la page, le like réapparaissait.
-- On enregistre le refus pour qu'il tienne.

CREATE TABLE IF NOT EXISTS public.dismissed_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, dismissed_user_id)
);

CREATE INDEX IF NOT EXISTS dismissed_likes_user_idx ON public.dismissed_likes (user_id);

ALTER TABLE public.dismissed_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own dismissals" ON public.dismissed_likes;
CREATE POLICY "Users manage their own dismissals"
ON public.dismissed_likes FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
