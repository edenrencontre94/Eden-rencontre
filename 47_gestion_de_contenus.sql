-- ============================================================
-- Gestion de contenus — blog, modération a priori, conversations signalées
-- ============================================================
-- Trois volets :
--
--   1. BLOG en base, éditable depuis le back-office. Les articles vivaient
--      dans `src/content/articles.ts` : publier demandait un déploiement.
--
--   2. APPROBATION des publications communautaires avant affichage —
--      activable, car la modération a priori ne se justifie que tant que
--      le volume reste tenable.
--
--   3. CONVERSATIONS SIGNALÉES, consultables par la modération.
--
-- SUR LE TROISIÈME POINT. La politique de confidentialité publiée engage :
-- « Vos conversations ne sont accessibles qu'à vous et à votre
-- interlocuteur. Elles peuvent être consultées par notre équipe de
-- modération DANS LE SEUL CAS D'UN SIGNALEMENT. »
--
-- L'accès est donc conditionné à l'existence d'un signalement ou d'un
-- ticket de support impliquant l'un des deux membres — et chaque
-- consultation est journalisée. Un accès libre à toutes les conversations
-- contredirait cet engagement ; il suppose d'abord de modifier la
-- politique, ce qui reste une décision d'exploitant, pas de code.

-- ------------------------------------------------------------
-- 1. Blog
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(trim(title)) >= 5),
  meta_description text CHECK (length(COALESCE(meta_description, '')) <= 300),
  excerpt text,
  category text NOT NULL DEFAULT 'Conseil',
  cover_url text,
  intro text,
  -- Sections en jsonb : [{ heading, body: [paragraphes] }]. Un tableau
  -- structuré plutôt que du HTML libre — le rendu reste maîtrisé et rien
  -- d'exécutable ne peut être injecté depuis le back-office.
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  conclusion text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamp with time zone,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS blog_posts_published_idx
ON public.blog_posts (published_at DESC) WHERE status = 'published';

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Lecture publique des articles PUBLIÉS, y compris sans compte : c'est
-- l'objet même d'un blog de référencement.
DROP POLICY IF EXISTS "Published posts are public" ON public.blog_posts;
CREATE POLICY "Published posts are public"
ON public.blog_posts FOR SELECT TO anon, authenticated
USING (status = 'published' AND published_at IS NOT NULL AND published_at <= timezone('utc'::text, now()));

DROP POLICY IF EXISTS "Admins manage posts" ON public.blog_posts;
CREATE POLICY "Admins manage posts"
ON public.blog_posts FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- `published_at` est posé par la base au passage en publié : envoyé par le
-- client, il permettrait d'antidater un article pour le faire remonter.
CREATE OR REPLACE FUNCTION public.stamp_blog_post()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());

  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := timezone('utc'::text, now());
  END IF;

  IF NEW.status = 'draft' THEN
    NEW.published_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_blog_post ON public.blog_posts;
CREATE TRIGGER trg_stamp_blog_post
BEFORE INSERT OR UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.stamp_blog_post();

-- ------------------------------------------------------------
-- 2. Approbation des publications communautaires
-- ------------------------------------------------------------
ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS community_posts_status_idx
ON public.community_posts (status, created_at DESC);

-- Le DEFAULT reste « approved » : l'existant ne doit pas disparaître du
-- fil au moment de la migration. C'est le trigger qui bascule en attente
-- quand la modération a priori est activée.
INSERT INTO public.app_settings (key, value, label) VALUES
  ('community_moderation', 'false'::jsonb, 'Approuver les publications avant affichage')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_post_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Le statut ne se déclare pas depuis le client : sans cette ligne, il
  -- suffirait d'envoyer « approved » pour contourner la file d'attente.
  IF public.setting_bool('community_moderation', false) AND NOT public.is_admin() THEN
    NEW.status := 'pending';
  ELSE
    NEW.status := 'approved';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_status ON public.community_posts;
CREATE TRIGGER trg_post_status
BEFORE INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.set_post_status();

-- Le fil ne montre que l'approuvé — sauf à son auteur, qui doit voir sa
-- publication en attente plutôt que de la croire perdue.
DROP POLICY IF EXISTS "Les publications sont visibles par tous" ON public.community_posts;
DROP POLICY IF EXISTS "Approved posts are visible" ON public.community_posts;
CREATE POLICY "Approved posts are visible"
ON public.community_posts FOR SELECT TO anon, authenticated
USING (
  status = 'approved'
  OR user_id = auth.uid()
  OR public.is_admin()
);

CREATE OR REPLACE FUNCTION public.admin_review_post(
  p_post_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF NOT p_approve AND length(trim(COALESCE(p_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'motif');
  END IF;

  UPDATE public.community_posts SET
    status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = auth.uid(),
    rejection_reason = CASE WHEN p_approve THEN NULL ELSE trim(p_reason) END
  WHERE id = p_post_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_pending_posts(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'moderation_active', public.setting_bool('community_moderation', false),
    'en_attente', (SELECT count(*) FROM public.community_posts WHERE status = 'pending'),
    'rejetes',    (SELECT count(*) FROM public.community_posts WHERE status = 'rejected'),
    'posts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id, 'text', c.text, 'category', c.category,
        'image_url', c.image_url, 'video_url', c.video_url,
        'created_at', c.created_at,
        'auteur', COALESCE(p.first_name, 'Membre'),
        'auteur_id', c.user_id,
        'auteur_photo', CASE WHEN p.photos IS NOT NULL AND array_length(p.photos, 1) > 0
                             THEN p.photos[1] ELSE NULL END,
        'signalements', (SELECT count(*) FROM public.reports r
                         WHERE r.reported_id = c.user_id AND r.status = 'pending')
      ) ORDER BY c.created_at ASC), '[]'::jsonb)
      FROM (
        SELECT * FROM public.community_posts
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
      ) c
      LEFT JOIN public.profiles p ON p.id = c.user_id
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- 3. Journal des accès aux conversations
-- ------------------------------------------------------------
-- Toute consultation laisse une trace. C'est ce qui distingue une
-- modération d'une surveillance : non pas l'intention, mais la
-- traçabilité — et c'est aussi ce qui protège l'exploitant le jour où un
-- membre conteste.
CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  match_id uuid,
  motif text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_access_log_idx
ON public.admin_access_log (created_at DESC);

ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read access log" ON public.admin_access_log;
CREATE POLICY "Admins read access log"
ON public.admin_access_log FOR SELECT TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------
-- 4. Conversations consultables
-- ------------------------------------------------------------
-- Seules celles dont un participant fait l'objet d'un signalement en cours
-- ou d'un ticket de support ouvert. C'est exactement le périmètre annoncé
-- dans la politique de confidentialité.
CREATE OR REPLACE FUNCTION public.admin_flagged_conversations(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'match_id', x.id,
      'user1', jsonb_build_object('id', a.id, 'nom', COALESCE(a.first_name, 'Membre'),
                                  'photo', CASE WHEN a.photos IS NOT NULL AND array_length(a.photos,1) > 0
                                                THEN a.photos[1] ELSE NULL END),
      'user2', jsonb_build_object('id', b.id, 'nom', COALESCE(b.first_name, 'Membre'),
                                  'photo', CASE WHEN b.photos IS NOT NULL AND array_length(b.photos,1) > 0
                                                THEN b.photos[1] ELSE NULL END),
      'nb_messages', (SELECT count(*) FROM public.messages m WHERE m.match_id = x.id),
      'dernier', (SELECT max(m.created_at) FROM public.messages m WHERE m.match_id = x.id),
      'motif', x.motif
    ) ORDER BY x.created_at DESC)
    FROM (
      SELECT mt.id, mt.created_at,
             (SELECT string_agg(DISTINCT r.reason, ', ')
              FROM public.reports r
              WHERE r.status = 'pending'
                AND r.reported_id IN (mt.user1_id, mt.user2_id)) AS motif
      FROM public.matches mt
      WHERE EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.status = 'pending'
          AND r.reported_id IN (mt.user1_id, mt.user2_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.status IN ('open', 'pending')
          AND t.user_id IN (mt.user1_id, mt.user2_id)
      )
      ORDER BY mt.created_at DESC
      LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    ) x
    LEFT JOIN public.profiles a ON a.id = (SELECT user1_id FROM public.matches WHERE id = x.id)
    LEFT JOIN public.profiles b ON b.id = (SELECT user2_id FROM public.matches WHERE id = x.id)
  ), '[]'::jsonb);
END;
$$;

-- La lecture d'une conversation exige un MOTIF, et l'écrit au journal.
-- La fonction n'est pas STABLE : elle produit un effet de bord voulu.
CREATE OR REPLACE FUNCTION public.admin_read_conversation(
  p_match_id uuid,
  p_motif text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_autorise boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF length(trim(COALESCE(p_motif, ''))) < 5 THEN
    RETURN jsonb_build_object('error', 'motif_requis');
  END IF;

  -- Contrôle du périmètre annoncé aux membres. Sans lui, la fonction
  -- ouvrirait n'importe quelle conversation : le journal constaterait
  -- l'abus sans l'empêcher.
  SELECT EXISTS (
    SELECT 1 FROM public.matches mt
    WHERE mt.id = p_match_id
      AND (
        EXISTS (SELECT 1 FROM public.reports r
                WHERE r.status = 'pending' AND r.reported_id IN (mt.user1_id, mt.user2_id))
        OR EXISTS (SELECT 1 FROM public.support_tickets t
                   WHERE t.status IN ('open', 'pending')
                     AND t.user_id IN (mt.user1_id, mt.user2_id))
      )
  ) INTO v_autorise;

  IF NOT v_autorise THEN
    RETURN jsonb_build_object('error', 'hors_perimetre');
  END IF;

  INSERT INTO public.admin_access_log (admin_id, match_id, motif)
  VALUES (auth.uid(), p_match_id, trim(p_motif));

  RETURN jsonb_build_object(
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'sender_id', m.sender_id,
        'auteur', COALESCE(p.first_name, 'Membre'),
        'content', m.content, 'media_type', m.media_type,
        'created_at', m.created_at
      ) ORDER BY m.created_at ASC)
      FROM public.messages m
      LEFT JOIN public.profiles p ON p.id = m.sender_id
      WHERE m.match_id = p_match_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_post(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_post(uuid, boolean, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_pending_posts(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pending_posts(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_flagged_conversations(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_flagged_conversations(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_read_conversation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_read_conversation(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 5. Contrôle
-- ------------------------------------------------------------
SELECT count(*) AS articles FROM public.blog_posts;

SELECT status, count(*) FROM public.community_posts GROUP BY status;

SELECT public.admin_pending_posts(5) AS file_moderation;
