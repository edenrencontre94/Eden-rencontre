-- ============================================================
-- Migration : ajout du support image/video dans community_posts
-- ============================================================

-- 1. Ajout de la colonne video_url (image_url existe deja)
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS video_url text;

-- ============================================================
-- 2. Bucket Supabase Storage "community-media"
--    Limites : images 5 MB, videos 25 MB
--    file_size_limit s'applique par fichier.
--    La validation image <= 5 MB / video <= 25 MB est faite cote client.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-media',
  'community-media',
  true,
  26214400,
  ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp','video/mp4','video/webm','video/quicktime','video/x-msvideo']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp','video/mp4','video/webm','video/quicktime','video/x-msvideo'];

-- Policy : lecture publique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'community_media_public_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "community_media_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'community-media');
  END IF;
END $$;

-- Policy : upload pour utilisateurs authentifies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'community_media_auth_upload' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "community_media_auth_upload"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'community-media'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Policy : suppression par le proprietaire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'community_media_owner_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "community_media_owner_delete"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'community-media'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
