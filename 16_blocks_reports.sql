-- ============================================================
-- Migration : blocages et signalements
-- ============================================================
-- Les boutons « Bloquer » et « Signaler » n'affichaient qu'un toast :
-- aucune des deux tables n'existait. Elles sont créées ici, et
-- 17_dismissed_swipes.sql gère le refus persistant.

-- ------------------------------------------------------------
-- 1. Blocages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own blocks" ON public.blocks;
CREATE POLICY "Users can view their own blocks"
ON public.blocks FOR SELECT
TO authenticated
USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can block someone" ON public.blocks;
CREATE POLICY "Users can block someone"
ON public.blocks FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can unblock" ON public.blocks;
CREATE POLICY "Users can unblock"
ON public.blocks FOR DELETE
TO authenticated
USING (auth.uid() = blocker_id);

-- ------------------------------------------------------------
-- 2. Signalements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Contexte : profil, message, publication communautaire…
  context text NOT NULL DEFAULT 'profile'
    CHECK (context IN ('profile', 'message', 'community_post', 'call')),
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (reporter_id <> reported_id)
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reported_idx ON public.reports (reported_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- On ne voit que ses propres signalements (la modération passe par la service key)
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
ON public.reports FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can report someone" ON public.reports;
CREATE POLICY "Users can report someone"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);
