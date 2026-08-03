-- ============================================================
-- Migration : signalisation des appels audio/vidéo
-- ============================================================
-- Sans cette table, l'appelant rejoint un canal Agora tout seul et
-- le destinataire n'est jamais prévenu : « la personne ne voit rien ».
-- La table sert de canal de signalisation (sonnerie, accepté, refusé…),
-- Agora ne transportant que le flux audio/vidéo une fois l'appel accepté.

CREATE TABLE IF NOT EXISTS public.calls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_type text NOT NULL CHECK (call_type IN ('audio', 'video')),
  -- ringing   : sonne chez le destinataire
  -- accepted  : décroché, les deux rejoignent le canal Agora
  -- declined  : refusé par le destinataire
  -- cancelled : l'appelant a raccroché avant la réponse
  -- missed    : sans réponse (expiration)
  -- ended     : appel terminé normalement
  status text NOT NULL DEFAULT 'ringing'
    CHECK (status IN ('ringing', 'accepted', 'declined', 'cancelled', 'missed', 'ended')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS calls_callee_status_idx ON public.calls (callee_id, status);
CREATE INDEX IF NOT EXISTS calls_match_idx ON public.calls (match_id, created_at DESC);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Les deux participants voient l'appel
DROP POLICY IF EXISTS "Participants can view their calls" ON public.calls;
CREATE POLICY "Participants can view their calls"
ON public.calls FOR SELECT
TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Seul l'appelant crée l'appel, et uniquement sur un de ses matches
DROP POLICY IF EXISTS "Caller can start a call" ON public.calls;
CREATE POLICY "Caller can start a call"
ON public.calls FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = caller_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
      AND (m.user1_id = callee_id OR m.user2_id = callee_id)
  )
);

-- Les deux participants font évoluer le statut (accepter, refuser, raccrocher)
DROP POLICY IF EXISTS "Participants can update their calls" ON public.calls;
CREATE POLICY "Participants can update their calls"
ON public.calls FOR UPDATE
TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id)
WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Réplication temps réel : c'est ce qui déclenche la sonnerie côté destinataire
ALTER TABLE public.calls REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
