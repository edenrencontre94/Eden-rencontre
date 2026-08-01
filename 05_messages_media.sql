-- 1. Ajouter colonnes media à la table messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type text; -- 'image' | 'video' | 'audio' | 'gif'

-- 2. Créer le bucket de stockage pour les médias du chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Politique: les utilisateurs connectés peuvent uploader leurs propres médias
CREATE POLICY "Users can upload chat media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- 4. Politique: tout le monde peut lire les médias du chat (bucket public)
CREATE POLICY "Chat media is publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-media');

-- 5. Politique: les utilisateurs peuvent supprimer leurs propres médias
CREATE POLICY "Users can delete own chat media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
