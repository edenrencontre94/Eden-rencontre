-- =====================================================================================
-- 09_eden_community.sql
-- Tables, RLS et triggers pour la fonctionnalité Communauté d'Eden Rencontre
-- À exécuter dans l'éditeur SQL de votre tableau de bord Supabase
-- =====================================================================================

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 1. TABLE : community_posts
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'Réflexion'
        CHECK (category IN ('Témoignage','Prière','Encouragement','Verset','Conseil','Réflexion','Question','Expérience')),
    text TEXT NOT NULL DEFAULT '' CHECK (char_length(text) <= 800),
    image_url TEXT,
    video_url TEXT,
    likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
    comments_count INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_posts_user ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_likes ON public.community_posts(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts(category);

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 2. TABLE : community_comments
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (char_length(text) <= 500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post ON public.community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_user ON public.community_comments(user_id);

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 3. TABLE : community_likes
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_likes (
    post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_likes_user ON public.community_likes(user_id);

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 4. TABLE : community_saves
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_saves (
    post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_saves_user ON public.community_saves(user_id);

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 5. TABLE : community_reports
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE(post_id, reporter_id)
);

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 6. ACTIVATION RLS
-- ──────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.community_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_saves    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports  ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 7. POLITIQUES RLS : community_posts
-- ──────────────────────────────────────────────────────────────────────────────────────
-- Tout utilisateur authentifié peut lire tous les posts
CREATE POLICY "community_posts_select"
  ON public.community_posts FOR SELECT
  TO authenticated
  USING (true);

-- Un utilisateur ne peut publier que pour lui-même
CREATE POLICY "community_posts_insert"
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Un utilisateur ne peut modifier que ses propres publications
CREATE POLICY "community_posts_update"
  ON public.community_posts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Un utilisateur peut supprimer ses propres publications ; les admins aussi
CREATE POLICY "community_posts_delete"
  ON public.community_posts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 8. POLITIQUES RLS : community_comments
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE POLICY "community_comments_select"
  ON public.community_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "community_comments_insert"
  ON public.community_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "community_comments_delete"
  ON public.community_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 9. POLITIQUES RLS : community_likes
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE POLICY "community_likes_select"
  ON public.community_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "community_likes_insert"
  ON public.community_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "community_likes_delete"
  ON public.community_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 10. POLITIQUES RLS : community_saves
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE POLICY "community_saves_select"
  ON public.community_saves FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "community_saves_insert"
  ON public.community_saves FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "community_saves_delete"
  ON public.community_saves FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 11. POLITIQUES RLS : community_reports
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE POLICY "community_reports_insert"
  ON public.community_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Seuls les admins (via service_role) lisent les signalements
CREATE POLICY "community_reports_select"
  ON public.community_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 12. TRIGGERS : Compteurs likes_count / comments_count
-- ──────────────────────────────────────────────────────────────────────────────────────

-- Fonction trigger pour les likes
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_likes_count ON public.community_likes;
CREATE TRIGGER trg_likes_count
  AFTER INSERT OR DELETE ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- Fonction trigger pour les commentaires
CREATE OR REPLACE FUNCTION public.update_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comments_count ON public.community_comments;
CREATE TRIGGER trg_comments_count
  AFTER INSERT OR DELETE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comments_count();

-- Fonction trigger pour mettre à jour edited_at automatiquement
CREATE OR REPLACE FUNCTION public.set_community_post_edited_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.edited_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_post_edited ON public.community_posts;
CREATE TRIGGER trg_community_post_edited
  BEFORE UPDATE OF text, category, image_url, video_url ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_community_post_edited_at();

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 13. BUCKET STORAGE : community-media
-- Assure que le bucket pour les photos/vidéos communautaires existe
-- ──────────────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-media',
  'community-media',
  true,
  26214400, -- 25 MB max
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Politique d'upload : uniquement les utilisateurs authentifiés, dans leur propre dossier
CREATE POLICY "community_media_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'community-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture publique des médias
CREATE POLICY "community_media_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'community-media');

-- Suppression : uniquement le propriétaire
CREATE POLICY "community_media_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'community-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ──────────────────────────────────────────────────────────────────────────────────────
-- 14. FONCTION RPC : mark_community_read
-- Permet de marquer la communauté comme "lue" pour le badge de navigation
-- ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_read_at (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.community_read_at ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_read_at_manage"
  ON public.community_read_at
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_community_read()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.community_read_at (user_id, read_at)
  VALUES (auth.uid(), timezone('utc', now()))
  ON CONFLICT (user_id) DO UPDATE SET read_at = timezone('utc', now());
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────────────
-- FIN DU SCRIPT
-- Pour valider, vérifiez que ces tables existent dans Table Editor de Supabase :
--   • community_posts
--   • community_comments
--   • community_likes
--   • community_saves
--   • community_reports
--   • community_read_at
-- Et que le bucket "community-media" est visible dans Storage.
-- ──────────────────────────────────────────────────────────────────────────────────────
