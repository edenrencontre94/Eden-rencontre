-- =====================================================================================
-- 15_all_missing_rpc_functions.sql
-- =====================================================================================
-- Ce script crée TOUTES les fonctions RPC manquantes nécessaires à l'app.
-- À exécuter dans le SQL Editor de Supabase (en une seule fois).
-- =====================================================================================

-- ─── 0. COLONNES MANQUANTES SUR profiles ──────────────────────────────────────
-- Ajouter les colonnes si elles ne sont pas déjà présentes

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qualities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flaws TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dealbreakers TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS looking_for TEXT,
  ADD COLUMN IF NOT EXISTS marriage_vision TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS marriage_intent TEXT,
  ADD COLUMN IF NOT EXISTS church_attendance TEXT,
  ADD COLUMN IF NOT EXISTS practice_level TEXT,
  ADD COLUMN IF NOT EXISTS baptized TEXT,
  ADD COLUMN IF NOT EXISTS seeking_gender TEXT,
  ADD COLUMN IF NOT EXISTS has_children TEXT,
  ADD COLUMN IF NOT EXISTS wants_children TEXT,
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
  ADD COLUMN IF NOT EXISTS share_location BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'tous',
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT,
  ADD COLUMN IF NOT EXISTS denomination TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- ─── Table reports (signalements) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports(reported_id);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());

-- ─── Table community_posts (si pas déjà créée) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT,
  category TEXT DEFAULT 'general',
  image_url TEXT,
  video_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  edited_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'published' CHECK (status IN ('pending','published','rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_posts_select" ON public.community_posts;
CREATE POLICY "community_posts_select" ON public.community_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
CREATE POLICY "community_posts_insert" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "community_posts_update_own" ON public.community_posts;
CREATE POLICY "community_posts_update_own" ON public.community_posts FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ─── Table community_read_at ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_read_at (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.community_read_at ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_read_manage" ON public.community_read_at;
CREATE POLICY "community_read_manage" ON public.community_read_at FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Table community_likes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_likes_manage" ON public.community_likes;
CREATE POLICY "community_likes_manage" ON public.community_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "community_likes_select" ON public.community_likes;
CREATE POLICY "community_likes_select" ON public.community_likes FOR SELECT TO authenticated USING (true);

-- ─── Table community_comments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_comments_select" ON public.community_comments;
CREATE POLICY "community_comments_select" ON public.community_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_comments_insert" ON public.community_comments;
CREATE POLICY "community_comments_insert" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "community_comments_delete_own" ON public.community_comments;
CREATE POLICY "community_comments_delete_own" ON public.community_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── Table staff_roles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_roles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','redacteur','support','moderator','admin')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_roles_select" ON public.staff_roles;
CREATE POLICY "staff_roles_select" ON public.staff_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ─── 1. update_last_seen ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen = timezone('utc', now())
  WHERE id = auth.uid();
END;
$$;

-- ─── 2. my_entitlements (plan, niveau, expiration) ────────────────────────────
CREATE OR REPLACE FUNCTION public.my_entitlements()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  p RECORD;
  plan_id TEXT;
  lvl INT;
BEGIN
  SELECT public_plan, premium_until, is_founder
  INTO p
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('plan', 'gratuit', 'level', 0, 'expires_at', null, 'is_founder', false);
  END IF;

  -- Vérifier si l'abonnement est encore actif
  IF p.is_founder THEN
    plan_id := 'premium';
    lvl := 1;
  ELSIF p.public_plan = 'premium' AND (p.premium_until IS NULL OR p.premium_until > now()) THEN
    plan_id := 'premium';
    lvl := 1;
  ELSE
    plan_id := 'gratuit';
    lvl := 0;
  END IF;

  RETURN json_build_object(
    'plan',       plan_id,
    'level',      lvl,
    'expires_at', p.premium_until,
    'is_founder', COALESCE(p.is_founder, false)
  );
END;
$$;

-- ─── 3. my_quotas ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_quotas()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  p RECORD;
  is_premium BOOLEAN;
  msg_count INT := 0;
  like_count INT := 0;
  sl_used TIMESTAMP WITH TIME ZONE;
  sl_available_at TIMESTAMP WITH TIME ZONE;
  today_start TIMESTAMP WITH TIME ZONE := date_trunc('day', timezone('utc', now()));
BEGIN
  SELECT public_plan, premium_until, is_founder
  INTO p FROM public.profiles WHERE id = uid;

  is_premium := COALESCE(p.is_founder, false) OR (
    p.public_plan = 'premium' AND (p.premium_until IS NULL OR p.premium_until > now())
  );

  IF is_premium THEN
    RETURN json_build_object(
      'plan', 'premium',
      'messages_left', -1,
      'messages_quota', -1,
      'level', 1,
      'likes_left', -1,
      'superlike_available_at', null
    );
  END IF;

  -- Messages envoyés aujourd'hui
  SELECT COUNT(*) INTO msg_count
  FROM public.messages m
  JOIN public.matches mt ON mt.id = m.match_id
  WHERE m.sender_id = uid
    AND m.created_at >= today_start
    AND m.type = 'text';

  -- Likes envoyés aujourd'hui
  SELECT COUNT(*) INTO like_count
  FROM public.swipes
  WHERE actor_id = uid
    AND action IN ('like','super_like')
    AND created_at >= today_start;

  -- Super like : disponible une fois par 7 jours
  SELECT super_likes_used_at INTO sl_used FROM public.user_quotas WHERE user_id = uid;
  IF sl_used IS NOT NULL THEN
    sl_available_at := sl_used + INTERVAL '7 days';
    IF sl_available_at <= now() THEN sl_available_at := null; END IF;
  END IF;

  RETURN json_build_object(
    'plan',                  'gratuit',
    'messages_left',         GREATEST(0, 5 - msg_count),
    'messages_quota',        5,
    'level',                 0,
    'likes_left',            GREATEST(0, 25 - like_count),
    'superlike_available_at', sl_available_at
  );
END;
$$;

-- ─── 4. my_permissions ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  user_role TEXT;
  perms TEXT[];
BEGIN
  SELECT role INTO user_role FROM public.staff_roles WHERE user_id = uid;

  IF user_role IS NULL OR user_role = 'member' THEN
    RETURN json_build_object('role', 'member', 'is_staff', false, 'permissions', '[]'::json);
  END IF;

  CASE user_role
    WHEN 'redacteur' THEN perms := ARRAY['contenus'];
    WHEN 'support' THEN perms := ARRAY['membres','support'];
    WHEN 'moderator' THEN perms := ARRAY['membres','moderation','conversations','contenus'];
    WHEN 'admin' THEN perms := ARRAY['membres','moderation','conversations','contenus','support','finances','reglages','equipe'];
    ELSE perms := ARRAY[]::TEXT[];
  END CASE;

  RETURN json_build_object(
    'role', user_role,
    'is_staff', true,
    'permissions', to_json(perms)
  );
END;
$$;

-- ─── 5. is_staff ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
      AND role IN ('redacteur','support','moderator','admin')
  );
END;
$$;

-- ─── 6. my_suspension ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_suspension()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT is_suspended, is_paused INTO p FROM public.profiles WHERE id = auth.uid();
  RETURN json_build_object(
    'is_suspended', COALESCE(p.is_suspended, false),
    'is_paused', COALESCE(p.is_paused, false)
  );
END;
$$;

-- ─── 7. discover_profiles ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.discover_profiles(
  p_country TEXT DEFAULT NULL,
  p_age_min INT DEFAULT 18,
  p_age_max INT DEFAULT 70,
  p_marital TEXT[] DEFAULT NULL,
  p_denomination TEXT[] DEFAULT NULL,
  p_attendance TEXT[] DEFAULT NULL,
  p_education TEXT[] DEFAULT NULL,
  p_intent TEXT[] DEFAULT NULL,
  p_height_min INT DEFAULT NULL,
  p_height_max INT DEFAULT NULL,
  p_max_km FLOAT DEFAULT NULL,
  p_verified BOOLEAN DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS SETOF public.profiles
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  current_gender TEXT;
  current_seeking TEXT;
BEGIN
  SELECT gender, seeking_gender INTO current_gender, current_seeking
  FROM public.profiles WHERE id = uid;

  RETURN QUERY
  SELECT p.* FROM public.profiles p
  WHERE
    -- Exclure soi-même
    p.id <> uid
    -- Exclure les profils masqués ou suspendus
    AND COALESCE(p.visibility, 'tous') <> 'pause'
    AND COALESCE(p.is_suspended, false) = false
    AND COALESCE(p.is_paused, false) = false
    -- Exclure les profils déjà swipés
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes s
      WHERE s.actor_id = uid AND s.target_id = p.id
    )
    -- Exclure les utilisateurs bloqués (dans les deux sens)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = uid AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = uid)
    )
    -- Genre cherché (si renseigné)
    AND (current_seeking IS NULL OR current_seeking = '' OR p.gender = current_seeking)
    -- Genre de l'autre (respect de sa préférence)
    AND (p.seeking_gender IS NULL OR p.seeking_gender = '' OR p.seeking_gender = current_gender)
    -- Âge
    AND (p.birth_date IS NULL OR EXTRACT(YEAR FROM age(p.birth_date)) BETWEEN p_age_min AND p_age_max)
    -- Pays
    AND (p_country IS NULL OR p_country = '' OR p.country = p_country)
    -- Filtres avancés (optionnels)
    AND (p_marital IS NULL OR p.marital_status = ANY(p_marital))
    AND (p_denomination IS NULL OR p.denomination = ANY(p_denomination))
    AND (p_attendance IS NULL OR p.church_attendance = ANY(p_attendance))
    AND (p_education IS NULL OR p.education = ANY(p_education))
    AND (p_intent IS NULL OR p.marriage_intent = ANY(p_intent))
    AND (p_height_min IS NULL OR p.height_cm >= p_height_min)
    AND (p_height_max IS NULL OR p.height_cm <= p_height_max)
    AND (p_verified IS NULL OR p.is_verified = p_verified)
    -- Au moins une photo
    AND p.photos IS NOT NULL AND array_length(p.photos, 1) > 0
  ORDER BY p.premium_until DESC NULLS LAST, RANDOM()
  LIMIT p_limit;
END;
$$;

-- ─── 8. filter_options ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.filter_options()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  pays JSON;
  denoms JSON;
  freq JSON;
  etudes JSON;
  intentions JSON;
  situations JSON;
BEGIN
  SELECT json_agg(r) INTO pays FROM (
    SELECT country AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE country IS NOT NULL AND country <> '' AND visibility <> 'pause'
    GROUP BY country ORDER BY n DESC LIMIT 50
  ) r;

  SELECT json_agg(r) INTO denoms FROM (
    SELECT denomination AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE denomination IS NOT NULL AND denomination <> '' AND visibility <> 'pause'
    GROUP BY denomination ORDER BY n DESC
  ) r;

  SELECT json_agg(r) INTO freq FROM (
    SELECT church_attendance AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE church_attendance IS NOT NULL AND church_attendance <> ''
    GROUP BY church_attendance ORDER BY n DESC
  ) r;

  SELECT json_agg(r) INTO etudes FROM (
    SELECT education AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE education IS NOT NULL AND education <> ''
    GROUP BY education ORDER BY n DESC
  ) r;

  SELECT json_agg(r) INTO intentions FROM (
    SELECT marriage_intent AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE marriage_intent IS NOT NULL AND marriage_intent <> ''
    GROUP BY marriage_intent ORDER BY n DESC
  ) r;

  SELECT json_agg(r) INTO situations FROM (
    SELECT marital_status AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE marital_status IS NOT NULL AND marital_status <> ''
    GROUP BY marital_status ORDER BY n DESC
  ) r;

  RETURN json_build_object(
    'pays',          COALESCE(pays, '[]'::json),
    'denominations', COALESCE(denoms, '[]'::json),
    'frequentation', COALESCE(freq, '[]'::json),
    'etudes',        COALESCE(etudes, '[]'::json),
    'intentions',    COALESCE(intentions, '[]'::json),
    'situations',    COALESCE(situations, '[]'::json)
  );
END;
$$;

-- ─── 9. my_last_messages ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_last_messages()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid UUID := auth.uid();
  result JSON;
BEGIN
  SELECT json_agg(conv ORDER BY conv.last_at DESC) INTO result
  FROM (
    SELECT
      mt.id AS match_id,
      CASE WHEN mt.user1_id = uid THEN mt.user2_id ELSE mt.user1_id END AS other_id,
      p.first_name,
      p.photos,
      p.public_plan,
      p.is_founder,
      m_last.content AS last_content,
      m_last.type AS last_type,
      m_last.created_at AS last_at,
      m_last.sender_id AS last_sender_id,
      COUNT(m_unread.id) AS unread_count
    FROM public.matches mt
    JOIN public.profiles p ON p.id = (CASE WHEN mt.user1_id = uid THEN mt.user2_id ELSE mt.user1_id END)
    LEFT JOIN LATERAL (
      SELECT content, type, created_at, sender_id
      FROM public.messages
      WHERE match_id = mt.id
      ORDER BY created_at DESC
      LIMIT 1
    ) m_last ON true
    LEFT JOIN public.messages m_unread ON m_unread.match_id = mt.id
      AND m_unread.sender_id <> uid
      AND m_unread.read_at IS NULL
    WHERE mt.user1_id = uid OR mt.user2_id = uid
    -- Exclure conversations archivées
    AND NOT EXISTS (
      SELECT 1 FROM public.archived_chats ac
      WHERE ac.user_id = uid AND ac.match_id = mt.id
    )
    GROUP BY mt.id, mt.user1_id, mt.user2_id, p.first_name, p.photos, p.public_plan, p.is_founder,
             m_last.content, m_last.type, m_last.created_at, m_last.sender_id
    ORDER BY m_last.created_at DESC NULLS LAST
    LIMIT 50
  ) conv;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ─── 10. submit_report ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_report(
  p_reported_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.reports (reporter_id, reported_id, reason, details)
  VALUES (auth.uid(), p_reported_id, p_reason, p_details)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─── 11. set_my_location ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_my_location(
  p_latitude FLOAT,
  p_longitude FLOAT,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET
    latitude = p_latitude,
    longitude = p_longitude,
    city = COALESCE(p_city, city),
    country = COALESCE(p_country, country),
    share_location = true
  WHERE id = auth.uid();
END;
$$;

-- ─── 12. delete_my_account ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_my_account(p_reason TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- On supprime le profil ; la cascade ON DELETE CASCADE supprime le reste
  DELETE FROM public.profiles WHERE id = auth.uid();
END;
$$;

-- ─── 13. open_support_ticket ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_support_ticket(
  p_subject TEXT,
  p_message TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_ticket_id UUID;
BEGIN
  INSERT INTO public.support_tickets (user_id, subject)
  VALUES (auth.uid(), p_subject)
  RETURNING id INTO new_ticket_id;

  INSERT INTO public.support_messages (ticket_id, sender_id, content, is_staff)
  VALUES (new_ticket_id, auth.uid(), p_message, false);

  RETURN new_ticket_id;
END;
$$;

-- ─── 14. mark_community_read ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_community_read()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.community_read_at (user_id, read_at)
  VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET read_at = now();
END;
$$;

-- ─── 15. admin_plan_counts (tableau de bord admin) ──────────────────────────
CREATE OR REPLACE FUNCTION public.admin_plan_counts()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vérifier que l'appelant est staff
  IF NOT (SELECT is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN (
    SELECT json_build_object(
      'gratuit',  COUNT(*) FILTER (WHERE public_plan = 'gratuit' OR public_plan = 'free' OR public_plan IS NULL),
      'premium',  COUNT(*) FILTER (WHERE public_plan = 'premium' AND (premium_until IS NULL OR premium_until > now()) OR is_founder),
      'expires_soon', COUNT(*) FILTER (WHERE public_plan = 'premium' AND premium_until BETWEEN now() AND now() + INTERVAL '7 days')
    )
    FROM public.profiles
  );
END;
$$;

-- ─── 16. admin_users_by_plan ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_users_by_plan(
  p_plan TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT (SELECT is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT json_agg(r) INTO result FROM (
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.gender,
      p.city,
      p.country,
      p.public_plan,
      p.premium_until,
      p.is_founder,
      p.is_verified,
      p.is_suspended,
      p.photos,
      p.created_at,
      p.last_seen
    FROM public.profiles p
    WHERE
      (p_plan IS NULL OR p.public_plan = p_plan OR (p_plan = 'premium' AND p.is_founder))
      AND (p_search IS NULL OR p_search = ''
           OR p.first_name ILIKE '%' || p_search || '%'
           OR p.last_name ILIKE '%' || p_search || '%')
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ─── 17. admin_user_detail ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  p RECORD;
BEGIN
  IF NOT (SELECT is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN row_to_json(p);
END;
$$;

-- ─── 18. admin_grant_days ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_grant_days(
  p_user_id UUID,
  p_days INT,
  p_note TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (SELECT is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE public.profiles
  SET
    public_plan = 'premium',
    premium_until = GREATEST(COALESCE(premium_until, now()), now()) + (p_days || ' days')::INTERVAL
  WHERE id = p_user_id;
END;
$$;

-- ─── 19. admin_suspend_user ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_duration_days INT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (SELECT is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE public.profiles
  SET is_suspended = true
  WHERE id = p_user_id;
END;
$$;

-- ─── 20. admin_unsuspend_user ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (SELECT is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE public.profiles
  SET is_suspended = false
  WHERE id = p_user_id;
END;
$$;

-- ─── 21. admin_analytics ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_analytics(p_days INT DEFAULT 30)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  since TIMESTAMP WITH TIME ZONE := now() - (p_days || ' days')::INTERVAL;
BEGIN
  IF NOT (SELECT is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN json_build_object(
    'new_users',    (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since),
    'new_matches',  (SELECT COUNT(*) FROM public.matches WHERE created_at >= since),
    'new_messages', (SELECT COUNT(*) FROM public.messages WHERE created_at >= since),
    'new_swipes',   (SELECT COUNT(*) FROM public.swipes WHERE created_at >= since),
    'revenue_xof',  (SELECT COALESCE(SUM(amount_xof),0) FROM public.payments WHERE status = 'completed' AND completed_at >= since)
  );
END;
$$;

-- ─── 22. admin_overview (stats générales pour l'accueil admin) ───────────────
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  since_30 TIMESTAMP WITH TIME ZONE := now() - INTERVAL '30 days';
BEGIN
  IF NOT (SELECT is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN json_build_object(
    'total_users',    (SELECT COUNT(*) FROM public.profiles),
    'premium_users',  (SELECT COUNT(*) FROM public.profiles WHERE (public_plan = 'premium' AND (premium_until IS NULL OR premium_until > now())) OR is_founder),
    'new_30d',        (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since_30),
    'pending_reports',(SELECT COUNT(*) FROM public.reports WHERE status = 'pending')
  );
END;
$$;

-- ─── 23. my_profile_completion ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_profile_completion()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  score integer := 0;
  total integer := 18;
  p RECORD;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN 0; END IF;

  IF p.first_name IS NOT NULL AND trim(p.first_name) <> '' THEN score := score + 1; END IF;
  IF p.last_name IS NOT NULL AND trim(p.last_name) <> '' THEN score := score + 1; END IF;
  IF p.birth_date IS NOT NULL THEN score := score + 1; END IF;
  IF p.gender IS NOT NULL AND trim(p.gender) <> '' THEN score := score + 1; END IF;
  IF p.city IS NOT NULL AND trim(p.city) <> '' THEN score := score + 1; END IF;
  IF p.country IS NOT NULL AND trim(p.country) <> '' THEN score := score + 1; END IF;
  IF p.photos IS NOT NULL AND array_length(p.photos, 1) > 0 THEN score := score + 1; END IF;
  IF p.bio IS NOT NULL AND trim(p.bio) <> '' THEN score := score + 1; END IF;
  IF p.denomination IS NOT NULL AND trim(p.denomination) <> '' THEN score := score + 1; END IF;
  IF p.practice_level IS NOT NULL AND trim(p.practice_level) <> '' THEN score := score + 1; END IF;
  IF p.church_attendance IS NOT NULL AND trim(p.church_attendance) <> '' THEN score := score + 1; END IF;
  IF p.seeking_gender IS NOT NULL AND trim(p.seeking_gender) <> '' THEN score := score + 1; END IF;
  IF p.marriage_intent IS NOT NULL AND trim(p.marriage_intent) <> '' THEN score := score + 1; END IF;
  IF p.wants_children IS NOT NULL AND trim(p.wants_children) <> '' THEN score := score + 1; END IF;
  IF p.marital_status IS NOT NULL AND trim(p.marital_status) <> '' THEN score := score + 1; END IF;
  IF p.education IS NOT NULL AND trim(p.education) <> '' THEN score := score + 1; END IF;
  IF p.height_cm IS NOT NULL THEN score := score + 1; END IF;
  IF p.interests IS NOT NULL AND array_length(p.interests, 1) > 0 THEN score := score + 1; END IF;

  RETURN LEAST(100, ROUND((score::numeric / total::numeric) * 100));
END;
$$;

-- ─── Mise à jour des app_settings : VIP → Premium ────────────────────────────
UPDATE public.app_settings
SET value = '1'::jsonb
WHERE key IN ('min_level_post_video', 'min_level_video_call', 'min_level_video_message')
  AND value = '"vip"'::jsonb;

UPDATE public.profiles SET public_plan = 'premium' WHERE public_plan = 'vip';

-- ─── Supprimer la colonne boosted_until si elle existe ───────────────────────
ALTER TABLE public.profiles DROP COLUMN IF EXISTS boosted_until;
