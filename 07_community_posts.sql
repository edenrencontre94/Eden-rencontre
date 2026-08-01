-- Création de la table pour les publications de la communauté
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  text text NOT NULL,
  image_url text,
  likes_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activation de RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité (RLS)
CREATE POLICY "Les publications sont visibles par tous"
  ON public.community_posts FOR SELECT
  USING (true);

CREATE POLICY "Les utilisateurs peuvent créer des publications"
  ON public.community_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent modifier leurs propres publications"
  ON public.community_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres publications"
  ON public.community_posts FOR DELETE
  USING (auth.uid() = user_id);

-- (Optionnel) Création de la table pour les likes
CREATE TABLE IF NOT EXISTS public.community_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes visibles par tous"
  ON public.community_likes FOR SELECT
  USING (true);

CREATE POLICY "Les utilisateurs peuvent liker"
  ON public.community_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent retirer leur like"
  ON public.community_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Fonction pour incrémenter/décrémenter les likes automatiquement (Trigger)
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suppression du trigger s'il existe déjà
DROP TRIGGER IF EXISTS on_like_change ON public.community_likes;

CREATE TRIGGER on_like_change
AFTER INSERT OR DELETE ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();
