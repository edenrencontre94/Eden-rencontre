-- ============================================================
-- Compteurs de notification sur la barre de navigation
-- ============================================================
-- Trois pastilles : messages non lus, demandes en attente, publications
-- non lues dans la communauté.
--
-- UNE SEULE FONCTION, et non trois requêtes REST. La barre est présente
-- sur toutes les pages et se rafraîchit régulièrement : trois allers-
-- retours par cycle, multipliés par tous les membres connectés, se
-- paieraient en latence et en quota Supabase.
--
-- `SECURITY DEFINER` avec `auth.uid()` en interne : le client ne passe
-- aucun identifiant, il ne peut donc pas lire les compteurs d'autrui.

-- ------------------------------------------------------------
-- 1. Dernière visite de la communauté
-- ------------------------------------------------------------
-- Il n'existait aucun repère de lecture pour les publications. Sans lui,
-- « non lu » ne veut rien dire : on ne peut que compter les publications
-- récentes, ce qui afficherait une pastille permanente.
CREATE TABLE IF NOT EXISTS public.community_reads (
  user_id   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.community_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chacun voit sa lecture" ON public.community_reads;
CREATE POLICY "Chacun voit sa lecture"
ON public.community_reads FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Chacun marque sa lecture" ON public.community_reads;
CREATE POLICY "Chacun marque sa lecture"
ON public.community_reads FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Chacun met à jour sa lecture" ON public.community_reads;
CREATE POLICY "Chacun met à jour sa lecture"
ON public.community_reads FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Appelée à l'ouverture de /communaute.
CREATE OR REPLACE FUNCTION public.mark_community_read()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  INSERT INTO public.community_reads (user_id, last_read)
  VALUES (auth.uid(), timezone('utc'::text, now()))
  -- Nom de table NON qualifié dans le DO UPDATE : `community_reads.x`
  -- désigne la ligne existante, `EXCLUDED.x` celle qu'on insère.
  ON CONFLICT (user_id) DO UPDATE
    SET last_read = EXCLUDED.last_read;
END;
$$;

-- ------------------------------------------------------------
-- 2. Les trois compteurs
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_badges()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_messages  integer := 0;
  v_demandes  integer := 0;
  v_posts     integer := 0;
  v_last_read timestamp with time zone;
  v_a_archive boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('messages', 0, 'demandes', 0, 'communaute', 0);
  END IF;

  -- La table d'archives n'existe que si la migration 56 est passée. On
  -- teste plutôt que de supposer : une fonction qui échoue ferait
  -- disparaître les trois pastilles, pas seulement celle des messages.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'archived_chats'
  ) INTO v_a_archive;

  -- ── Messages non lus ──
  -- Reçus, jamais lus, hors conversations archivées et hors membres
  -- bloqués — la pastille doit correspondre à ce que la liste montre.
  SELECT count(*) INTO v_messages
  FROM public.messages m
  JOIN public.matches ma ON ma.id = m.match_id
  WHERE m.sender_id <> v_user
    AND m.read_at IS NULL
    AND (ma.user1_id = v_user OR ma.user2_id = v_user)
    AND NOT public.blocage_entre(v_user, m.sender_id)
    AND (
      NOT v_a_archive
      OR NOT EXISTS (
        SELECT 1 FROM public.archived_chats a
        WHERE a.user_id = v_user AND a.match_id = m.match_id
      )
    );

  -- ── Demandes en attente ──
  -- Likes et Super Likes reçus auxquels on n'a pas encore répondu.
  -- Les mêmes exclusions que la page /demandes : bloqués et écartés.
  SELECT count(*) INTO v_demandes
  FROM public.swipes s
  WHERE s.target_id = v_user
    AND s.action IN ('like', 'superlike')
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes r
      WHERE r.swiper_id = v_user AND r.target_id = s.swiper_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_user AND b.blocked_id = s.swiper_id)
         OR (b.blocker_id = s.swiper_id AND b.blocked_id = v_user)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.dismissed_likes d
      WHERE d.user_id = v_user AND d.dismissed_user_id = s.swiper_id
    );

  -- ── Publications non lues ──
  SELECT last_read INTO v_last_read
  FROM public.community_reads WHERE user_id = v_user;

  -- Jamais ouvert la communauté : on ne remonte pas tout l'historique.
  -- Une pastille à « 428 » à la première connexion décourage au lieu
  -- d'attirer. On part de l'inscription du membre.
  IF v_last_read IS NULL THEN
    SELECT created_at INTO v_last_read FROM public.profiles WHERE id = v_user;
    v_last_read := COALESCE(v_last_read, timezone('utc'::text, now()));
  END IF;

  SELECT count(*) INTO v_posts
  FROM public.community_posts p
  WHERE p.created_at > v_last_read
    AND p.user_id <> v_user           -- ses propres publications ne sont pas des nouveautés
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_user AND b.blocked_id = p.user_id)
         OR (b.blocker_id = p.user_id AND b.blocked_id = v_user)
    )
    -- La colonne `status` vient de la migration 47 (modération). Le
    -- COALESCE laisse la fonction juste si 47 n'est pas passée.
    AND COALESCE(p.status, 'approved') = 'approved';

  RETURN jsonb_build_object(
    'messages',   v_messages,
    'demandes',   v_demandes,
    'communaute', v_posts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_badges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_badges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_community_read() TO authenticated;

-- ------------------------------------------------------------
-- 3. Index de soutien
-- ------------------------------------------------------------
-- La fonction est appelée à chaque cycle de rafraîchissement, par tous
-- les membres connectés. Sans ces index, chaque appel balaierait
-- `messages` et `swipes` en entier.
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (match_id, sender_id) WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS swipes_target_action_idx
  ON public.swipes (target_id, action);

CREATE INDEX IF NOT EXISTS community_posts_created_idx
  ON public.community_posts (created_at DESC);

NOTIFY pgrst, 'reload schema';

-- Contrôle : renvoie vos propres compteurs si exécuté depuis l'app,
-- des zéros depuis l'éditeur SQL (auth.uid() y est NULL).
SELECT public.my_badges();
