-- ============================================================
-- Migration : Accusés de lecture des messages (read_at)
-- ============================================================
-- Sans cette migration, l'app ne peut pas écrire read_at :
-- le badge de non-lus ne disparaît jamais et les ✓✓ ne s'affichent pas.
--
-- Note : la table possédait une colonne booléenne "read" qui n'était
-- utilisée nulle part dans le code. On la remplace par un timestamp
-- "read_at" (permet d'afficher l'heure de lecture), en reprenant
-- l'ancienne valeur. La colonne "read" est laissée en place par
-- sécurité — supprimez-la avec l'étape 6 quand vous êtes serein.

-- 1. Ajouter la colonne read_at
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

-- 2. Reprendre l'ancienne colonne booléenne "read" si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'read'
  ) THEN
    EXECUTE $sql$
      UPDATE public.messages
      SET read_at = COALESCE(created_at, timezone('utc'::text, now()))
      WHERE read_at IS NULL AND read IS TRUE
    $sql$;
  END IF;
END $$;

-- 3. Le destinataire d'un message peut le marquer comme lu.
--    (il doit faire partie du match, et ne pas être l'expéditeur)
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.messages;
CREATE POLICY "Recipients can mark messages as read"
ON public.messages FOR UPDATE
TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = messages.match_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = messages.match_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- 4. Index pour le comptage des non-lus (requête de la page Messages)
CREATE INDEX IF NOT EXISTS messages_unread_idx
ON public.messages (match_id, sender_id)
WHERE read_at IS NULL;

-- 5. Index pour récupérer le dernier message d'une conversation
CREATE INDEX IF NOT EXISTS messages_match_created_idx
ON public.messages (match_id, created_at DESC);

-- 6. Realtime : diffuser aussi les UPDATE (pour que ✓ devienne ✓✓ en direct)
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- déjà dans la publication
END $$;

-- 7. (Optionnel, à exécuter plus tard) Supprimer l'ancienne colonne :
-- ALTER TABLE public.messages DROP COLUMN IF EXISTS read;
