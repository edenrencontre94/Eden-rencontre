-- =====================================================================================
-- 10_eden_full_infrastructure.sql
-- Infrastructure complète pour rendre tous les menus fonctionnels en production
-- Tables : swipes, matches, messages, profile_visits, blocks, dismissed_likes,
--          archived_chats, push_subscriptions, calls, support_tickets/messages,
--          email_preferences, app_settings, blog_posts, daily_content
-- Fonctions RPC : my_badges, get_or_create_match, etc.
-- À exécuter dans SQL Editor de votre tableau de bord Supabase
-- =====================================================================================


-- ══════════════════════════════════════════════════════════════════════════════════════
-- A. EXTENSIONS
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- recherche rapide par nom


-- ══════════════════════════════════════════════════════════════════════════════════════
-- B. COLONNES MANQUANTES SUR profiles
--    Le schéma initial (01) est minimal ; les menus ont besoin de colonnes supplém.
-- ══════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS looking_for TEXT,
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS profession TEXT,
  ADD COLUMN IF NOT EXISTS height INTEGER,
  ADD COLUMN IF NOT EXISTS has_children BOOLEAN,
  ADD COLUMN IF NOT EXISTS wants_children TEXT,
  ADD COLUMN IF NOT EXISTS church TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'tous' CHECK (visibility IN ('tous','demande','pause'));


-- ══════════════════════════════════════════════════════════════════════════════════════
-- C. SWIPES  (Découvrir — cartes à swiper)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.swipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like','pass','super_like')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(actor_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_swipes_actor  ON public.swipes(actor_id);
CREATE INDEX IF NOT EXISTS idx_swipes_target ON public.swipes(target_id);
CREATE INDEX IF NOT EXISTS idx_swipes_action ON public.swipes(action);

ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swipes_select" ON public.swipes FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR target_id = auth.uid());
CREATE POLICY "swipes_insert" ON public.swipes FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE POLICY "swipes_update" ON public.swipes FOR UPDATE TO authenticated
  USING (actor_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- D. MATCHES  (Demandes — quand deux likes se croisent)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON public.matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON public.matches(user2_id);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select" ON public.matches FOR SELECT TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY "matches_insert" ON public.matches FOR INSERT TO authenticated
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- E. MESSAGES  (Messagerie)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text','image','video','audio','gif','sticker','call')),
  media_url TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_match   ON public.messages(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender  ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread  ON public.messages(match_id) WHERE read_at IS NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  ));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  ));
CREATE POLICY "messages_update" ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  ));


-- Bucket stockage pour les médias de chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-media', 'chat-media', true, 26214400,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','audio/mpeg','audio/ogg','audio/webm'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat_media_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "chat_media_read"   ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat-media');
CREATE POLICY "chat_media_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ══════════════════════════════════════════════════════════════════════════════════════
-- F. PROFILE_VISITS  (Accueil — qui a vu votre profil)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profile_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visited_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(visitor_id, visited_id)
);
CREATE INDEX IF NOT EXISTS idx_visits_visited ON public.profile_visits(visited_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON public.profile_visits(visitor_id);

ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visits_select" ON public.profile_visits FOR SELECT TO authenticated
  USING (visitor_id = auth.uid() OR visited_id = auth.uid());
CREATE POLICY "visits_insert" ON public.profile_visits FOR INSERT TO authenticated
  WITH CHECK (visitor_id = auth.uid());
CREATE POLICY "visits_upsert" ON public.profile_visits FOR UPDATE TO authenticated
  USING (visitor_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- G. BLOCKS  (Blocage d'utilisateurs)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_manage" ON public.blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- H. DISMISSED_LIKES  (Refus d'un like sans bloquer)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.dismissed_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(user_id, dismissed_id)
);

ALTER TABLE public.dismissed_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dismissed_likes_manage" ON public.dismissed_likes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- I. ARCHIVED_CHATS  (Conversations archivées)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.archived_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(user_id, match_id)
);

ALTER TABLE public.archived_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archived_chats_manage" ON public.archived_chats FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- J. CALLS  (Appels audio/vidéo)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'audio' CHECK (type IN ('audio','video')),
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing','ongoing','ended','missed','declined')),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calls_match ON public.calls(match_id, created_at DESC);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());
CREATE POLICY "calls_insert" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid());
CREATE POLICY "calls_update" ON public.calls FOR UPDATE TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- K. PUSH_SUBSCRIPTIONS  (Notifications push PWA)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_manage" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- L. EMAIL_PREFERENCES  (Préférences de notifications)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  new_match BOOLEAN DEFAULT TRUE,
  new_message BOOLEAN DEFAULT TRUE,
  new_like BOOLEAN DEFAULT TRUE,
  community_digest BOOLEAN DEFAULT FALSE,
  promotions BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_prefs_manage" ON public.email_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- M. SUPPORT_TICKETS + SUPPORT_MESSAGES  (Aide / support)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user   ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_select" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "support_tickets_insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_msg_ticket ON public.support_messages(ticket_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_messages_select" ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  ));
CREATE POLICY "support_messages_insert" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()
  ));


-- ══════════════════════════════════════════════════════════════════════════════════════
-- N. APP_SETTINGS  (Paramètres globaux de l'application)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les paramètres publics (pixel_id, etc.)
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);
-- Seul le rôle service peut écrire (via Edge Function ou admin)

-- Valeurs par défaut indispensables
INSERT INTO public.app_settings (key, value) VALUES
  ('meta_pixel_id',        'null'::jsonb),
  ('community_moderation', '"standard"'::jsonb),
  ('min_level_post_image', '"premium"'::jsonb),
  ('min_level_post_video', '"vip"'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════════════
-- O. DAILY_CONTENT  (Verset du jour + défi hebdo)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.daily_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  verse_text TEXT NOT NULL,
  verse_ref TEXT NOT NULL,
  challenge_title TEXT NOT NULL DEFAULT 'Défi spirituel',
  challenge_text TEXT NOT NULL
);

ALTER TABLE public.daily_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_content_select" ON public.daily_content FOR SELECT TO authenticated USING (true);

-- Contenu du jour par défaut (sera remplacé via l'admin)
INSERT INTO public.daily_content (date, verse_text, verse_ref, challenge_title, challenge_text)
VALUES (
  CURRENT_DATE,
  'Celui qui a trouvé une femme a trouvé une bonne chose, et il a obtenu la faveur de l''Éternel.',
  'Proverbes 18:22',
  'Défi de la semaine',
  'Priez chaque jour cette semaine pour la personne que Dieu vous destine. Confiez-lui votre cœur et vos attentes.'
)
ON CONFLICT (date) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════════════
-- P. BOOST  (Booster son profil dans Découvrir)
-- ══════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMP WITH TIME ZONE;


-- ══════════════════════════════════════════════════════════════════════════════════════
-- Q. QUOTAS  (Super Likes, boosts — suivis par utilisateur)
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_quotas (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  super_likes_used_at TIMESTAMP WITH TIME ZONE,
  boosts_used_at TIMESTAMP WITH TIME ZONE,
  rewinds_used_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_quotas_manage" ON public.user_quotas FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════════════
-- R. BUCKET PHOTOS  (Photos du profil)
-- ══════════════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', true, 10485760,
  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "photos_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos_read"   ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'photos');
CREATE POLICY "photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ══════════════════════════════════════════════════════════════════════════════════════
-- S. FONCTIONS RPC  — Badges de navigation
-- ══════════════════════════════════════════════════════════════════════════════════════

-- Compteurs messages non lus + demandes (likes reçus) + posts communauté non vus
CREATE OR REPLACE FUNCTION public.my_badges()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  n_messages INT := 0;
  n_demandes INT := 0;
  n_communaute INT := 0;
  last_read TIMESTAMP WITH TIME ZONE;
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('messages', 0, 'demandes', 0, 'communaute', 0);
  END IF;

  -- Messages non lus envoyés par l'autre partie dans mes conversations
  SELECT COUNT(*) INTO n_messages
  FROM public.messages m
  JOIN public.matches mt ON mt.id = m.match_id
  WHERE (mt.user1_id = uid OR mt.user2_id = uid)
    AND m.sender_id <> uid
    AND m.read_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.archived_chats ac
      WHERE ac.user_id = uid AND ac.match_id = m.match_id
    );

  -- Likes / super_likes reçus non encore traités
  SELECT COUNT(*) INTO n_demandes
  FROM public.swipes s
  WHERE s.target_id = uid
    AND s.action IN ('like', 'super_like')
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes me
      WHERE me.actor_id = uid AND me.target_id = s.actor_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.dismissed_likes dl
      WHERE dl.user_id = uid AND dl.dismissed_id = s.actor_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = uid AND b.blocked_id = s.actor_id)
         OR (b.blocker_id = s.actor_id AND b.blocked_id = uid)
    );

  -- Publications communauté non vues depuis la dernière lecture
  SELECT read_at INTO last_read
  FROM public.community_read_at
  WHERE user_id = uid;

  IF last_read IS NULL THEN
    SELECT COUNT(*) INTO n_communaute FROM public.community_posts
    WHERE user_id <> uid;
  ELSE
    SELECT COUNT(*) INTO n_communaute FROM public.community_posts
    WHERE created_at > last_read AND user_id <> uid;
  END IF;

  RETURN json_build_object(
    'messages',   LEAST(n_messages, 99),
    'demandes',   LEAST(n_demandes, 99),
    'communaute', LEAST(n_communaute, 99)
  );
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════════════
-- T. FONCTION RPC — Création ou récupération d'un match
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_or_create_match(p_other_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  u1 UUID; u2 UUID;
  match_id UUID;
BEGIN
  -- user1 < user2 est la contrainte unique
  IF uid < p_other_id THEN u1 := uid; u2 := p_other_id;
  ELSE u1 := p_other_id; u2 := uid; END IF;

  -- Chercher un match existant
  SELECT id INTO match_id FROM public.matches
  WHERE user1_id = u1 AND user2_id = u2;

  IF match_id IS NULL THEN
    INSERT INTO public.matches (user1_id, user2_id)
    VALUES (u1, u2)
    RETURNING id INTO match_id;
  END IF;

  RETURN match_id;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════════════
-- U. RÉALTIME — Activer les publications temps réel sur les tables clés
-- ══════════════════════════════════════════════════════════════════════════════════════
-- Ces commandes activent la réplication pour le Realtime Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.swipes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;


-- ══════════════════════════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- Vérifiez dans Table Editor que toutes ces tables existent :
--   profiles (avec les nouvelles colonnes), swipes, matches, messages,
--   profile_visits, blocks, dismissed_likes, archived_chats, calls,
--   push_subscriptions, email_preferences, support_tickets, support_messages,
--   app_settings, daily_content, user_quotas, community_read_at
-- Et dans Storage que ces buckets existent :
--   photos, chat-media, community-media
-- ══════════════════════════════════════════════════════════════════════════════════════
