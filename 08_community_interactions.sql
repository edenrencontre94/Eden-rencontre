-- ─── Sauvegardes de posts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_saves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.community_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Saves visibles par le propriétaire"
  ON public.community_saves FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent sauvegarder"
  ON public.community_saves FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent retirer une sauvegarde"
  ON public.community_saves FOR DELETE USING (auth.uid() = user_id);

-- ─── Commentaires sur les posts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL CHECK (char_length(text) > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Commentaires visibles par tous"
  ON public.community_comments FOR SELECT USING (true);

CREATE POLICY "Les utilisateurs peuvent commenter"
  ON public.community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent supprimer leur commentaire"
  ON public.community_comments FOR DELETE USING (auth.uid() = user_id);

-- Ajouter un compteur de commentaires sur community_posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

-- Trigger pour mettre à jour le compteur de commentaires
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_change ON public.community_comments;
CREATE TRIGGER on_comment_change
AFTER INSERT OR DELETE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- ─── Signalements de posts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL DEFAULT 'inappropriate',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(post_id, reporter_id)
);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signalements visibles par admins" ON public.community_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Les utilisateurs peuvent signaler" ON public.community_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
