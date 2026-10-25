-- ==============================================================================
-- 37_fix_messages_table_and_rls.sql
-- Correction de la table messages et des politiques RLS
-- ==============================================================================

-- 1. S'assurer que toutes les colonnes requises existent sur public.messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());

-- Assouplir ou supprimer d'anciennes contraintes restrictives si présentes
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_type_check 
  CHECK (type IS NULL OR type IN ('text','image','video','audio','gif','sticker','call'));

-- 2. Index de performance
CREATE INDEX IF NOT EXISTS idx_messages_match ON public.messages(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(match_id) WHERE read_at IS NULL;

-- 3. Réactiver RLS et redéfinir des politiques propres et fonctionnelles
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Nettoyer les anciennes politiques
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages of their matches" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages to their matches" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages of their matches" ON public.messages;

-- A. SELECT : Les deux membres du match peuvent lire les messages
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- B. INSERT : Le sender doit être l'utilisateur connecté et faire partie du match
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- C. UPDATE : Pour marquer lu (read_at)
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- D. DELETE : Les deux participants peuvent supprimer les messages
DROP POLICY IF EXISTS "messages_delete" ON public.messages;
CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- 4. Permissions d'accès aux tables
GRANT ALL ON public.messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
