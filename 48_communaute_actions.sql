-- ============================================================
-- Communauté — droits sur les actions, et signalements qui remontent
-- ============================================================
-- TROIS PROBLÈMES, dont deux qui n'avaient jamais été remarqués parce
-- qu'ils échouent en silence.
--
--   1. SUPPRESSION D'UNE PUBLICATION. Les politiques de la migration 07
--      n'indiquaient aucun rôle : `FOR DELETE USING (auth.uid() = user_id)`
--      s'applique alors à PUBLIC. Combinée aux politiques ajoutées depuis
--      avec `TO authenticated`, la lecture des droits devient dépendante de
--      l'ordre d'exécution des migrations. Elles sont ici réécrites de
--      façon explicite et idempotente.
--
--   2. SIGNALEMENTS DE PUBLICATIONS INVISIBLES. `community_reports` est
--      alimentée par la communauté, mais la page Modération lit `reports` —
--      une autre table. Chaque signalement de publication tombait donc
--      dans le vide depuis le premier jour. Pire, sa politique de lecture
--      s'intitule « Signalements visibles par admins » alors qu'elle ne
--      laisse voir que ses PROPRES signalements : personne n'a jamais rien
--      pu lire.
--
--   3. COMMENTAIRES INSUPPRIMABLES PAR LA MODÉRATION. Seul l'auteur
--      pouvait effacer son commentaire. Un propos déplacé sous une
--      publication ne pouvait être retiré que par celui qui l'avait écrit.

-- ------------------------------------------------------------
-- 1. Publications : droits explicites
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Les utilisateurs peuvent créer des publications" ON public.community_posts;
CREATE POLICY "Members create posts"
ON public.community_posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les utilisateurs peuvent modifier leurs propres publications" ON public.community_posts;
DROP POLICY IF EXISTS "Members update own posts" ON public.community_posts;
CREATE POLICY "Members update own posts"
ON public.community_posts FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les utilisateurs peuvent supprimer leurs propres publications" ON public.community_posts;
DROP POLICY IF EXISTS "Members delete own posts" ON public.community_posts;
CREATE POLICY "Members delete own posts"
ON public.community_posts FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Les politiques d'administration sont recréées ici aussi : la migration 37
-- a pu ne pas être exécutée, et rien ne doit dépendre de cet ordre.
DROP POLICY IF EXISTS "Admins remove any post" ON public.community_posts;
CREATE POLICY "Admins remove any post"
ON public.community_posts FOR DELETE TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update any post" ON public.community_posts;
CREATE POLICY "Admins update any post"
ON public.community_posts FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 2. Commentaires : la modération peut retirer
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Les utilisateurs peuvent supprimer leur commentaire" ON public.community_comments;
DROP POLICY IF EXISTS "Delete own comment" ON public.community_comments;
CREATE POLICY "Delete own comment"
ON public.community_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins delete any comment" ON public.community_comments;
CREATE POLICY "Admins delete any comment"
ON public.community_comments FOR DELETE TO authenticated
USING (public.is_admin());

-- L'auteur d'une publication peut retirer un commentaire de son fil.
-- C'est le minimum sur une plateforme où l'on partage une prière ou un
-- témoignage : rester exposé à une réponse blessante sous SON texte, en
-- attendant qu'un administrateur passe, n'est pas acceptable.
DROP POLICY IF EXISTS "Post author moderates comments" ON public.community_comments;
CREATE POLICY "Post author moderates comments"
ON public.community_comments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = post_id AND p.user_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- 3. Signalements de publications : enfin lisibles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Signalements visibles par admins" ON public.community_reports;
CREATE POLICY "Post reports readable"
ON public.community_reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id OR public.is_admin());

ALTER TABLE public.community_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS community_reports_status_idx
ON public.community_reports (status, created_at DESC);

DROP POLICY IF EXISTS "Admins review post reports" ON public.community_reports;
CREATE POLICY "Admins review post reports"
ON public.community_reports FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Les signalements de publications, avec le contenu visé : sans le texte
-- sous les yeux, le signalement n'est qu'un numéro et ne se traite pas.
CREATE OR REPLACE FUNCTION public.admin_post_reports(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'en_attente', (SELECT count(*) FROM public.community_reports WHERE status = 'pending'),
    'signalements', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cr.id,
        'reason', cr.reason,
        'status', cr.status,
        'created_at', cr.created_at,
        'nb_signalements', (SELECT count(*) FROM public.community_reports x
                            WHERE x.post_id = cr.post_id),
        'post', jsonb_build_object(
          'id', cp.id, 'text', cp.text, 'category', cp.category,
          'image_url', cp.image_url, 'video_url', cp.video_url,
          'status', cp.status, 'created_at', cp.created_at,
          'auteur', COALESCE(au.first_name, 'Membre'),
          'auteur_id', cp.user_id
        ),
        'signalant', COALESCE(rp.first_name, 'Membre')
      ) ORDER BY cr.created_at DESC)
      FROM (
        SELECT * FROM public.community_reports
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
      ) cr
      LEFT JOIN public.community_posts cp ON cp.id = cr.post_id
      LEFT JOIN public.profiles au ON au.id = cp.user_id
      LEFT JOIN public.profiles rp ON rp.id = cr.reporter_id
    ), '[]'::jsonb)
  );
END;
$$;

-- Traiter un signalement : le retirer de la file, et retirer la
-- publication si nécessaire — les deux dans la même transaction, sinon un
-- signalement traité peut laisser en ligne le contenu qui l'a motivé.
CREATE OR REPLACE FUNCTION public.admin_review_post_report(
  p_report_id uuid,
  p_action text            -- 'dismiss' | 'hide' | 'delete'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_post uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_action NOT IN ('dismiss', 'hide', 'delete') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'action');
  END IF;

  SELECT post_id INTO v_post FROM public.community_reports WHERE id = p_report_id;
  IF v_post IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'introuvable');
  END IF;

  IF p_action = 'hide' THEN
    UPDATE public.community_posts
    SET status = 'rejected',
        reviewed_at = timezone('utc'::text, now()),
        reviewed_by = auth.uid(),
        rejection_reason = 'Retirée à la suite d''un signalement'
    WHERE id = v_post;
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.community_posts WHERE id = v_post;
  END IF;

  -- Tous les signalements de la même publication sont clos d'un coup :
  -- les traiter un par un ferait réapparaître la file pour un contenu
  -- déjà jugé.
  UPDATE public.community_reports SET
    status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END,
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = auth.uid()
  WHERE post_id = v_post AND status = 'pending';

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_post_reports(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_post_reports(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_review_post_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_post_report(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 4. Contrôle — à lire attentivement
-- ------------------------------------------------------------
-- Les droits réellement en vigueur sur les tables de la communauté.
-- La colonne `roles` doit indiquer {authenticated} partout, et non {public}.
SELECT
  tablename,
  policyname,
  cmd        AS operation,
  roles,
  qual       AS condition_lecture,
  with_check AS condition_ecriture
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('community_posts', 'community_comments',
                    'community_likes', 'community_saves', 'community_reports')
ORDER BY tablename, cmd, policyname;

-- Signalements de publications restés sans réponse depuis le début.
SELECT count(*) AS signalements_jamais_traites
FROM public.community_reports WHERE status = 'pending';
