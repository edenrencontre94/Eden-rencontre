-- ==============================================================================
-- 31_missing_admin_rpcs.sql
-- Corrige et remplace TOUTES les fonctions RPC admin pour qu'elles correspondent
-- exactement à ce que le frontend React attend.
-- À exécuter dans Supabase → SQL Editor
-- ==============================================================================

-- ─── 0. Colonnes manquantes dans les tables existantes ──────────────────────

ALTER TABLE public.community_reports
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending','dismissed','resolved'));

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS first_reply_at TIMESTAMPTZ;

ALTER TABLE public.support_messages
  ALTER COLUMN sender_id DROP NOT NULL;

-- ─── 1. Table journal d'accès admin ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_id TEXT,
  motif TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

-- ─── 2. RLS manquantes ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "app_settings_admin_update" ON public.app_settings;
CREATE POLICY "app_settings_admin_update" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "support_tickets_staff_select" ON public.support_tickets;
CREATE POLICY "support_tickets_staff_select" ON public.support_tickets
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "support_tickets_staff_update" ON public.support_tickets;
CREATE POLICY "support_tickets_staff_update" ON public.support_tickets
  FOR UPDATE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "support_messages_staff_select" ON public.support_messages;
CREATE POLICY "support_messages_staff_select" ON public.support_messages
  FOR SELECT TO authenticated USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "support_messages_staff_insert" ON public.support_messages;
CREATE POLICY "support_messages_staff_insert" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    public.is_staff() OR (
      sender_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "community_posts_admin_update" ON public.community_posts;
CREATE POLICY "community_posts_admin_update" ON public.community_posts
  FOR UPDATE TO authenticated USING (public.is_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS "community_posts_admin_delete" ON public.community_posts;
CREATE POLICY "community_posts_admin_delete" ON public.community_posts
  FOR DELETE TO authenticated USING (public.is_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS "community_reports_insert" ON public.community_reports;
CREATE POLICY "community_reports_insert" ON public.community_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "community_reports_select_own" ON public.community_reports;
CREATE POLICY "community_reports_select_own" ON public.community_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "community_reports_admin_update" ON public.community_reports;
CREATE POLICY "community_reports_admin_update" ON public.community_reports
  FOR UPDATE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "reports_staff_select" ON public.reports;
CREATE POLICY "reports_staff_select" ON public.reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "reports_staff_update" ON public.reports;
CREATE POLICY "reports_staff_update" ON public.reports
  FOR UPDATE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "blocks_staff_select" ON public.blocks;
CREATE POLICY "blocks_staff_select" ON public.blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid() OR public.is_staff());

-- ==============================================================================
-- FONCTIONS RPC
-- ==============================================================================

-- ─── A. admin_support_stats ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_support_stats();
CREATE OR REPLACE FUNCTION public.admin_support_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT json_build_object(
    'open',    COUNT(*) FILTER (WHERE status = 'open'),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'resolved',COUNT(*) FILTER (WHERE status = 'resolved'),
    'closed',  COUNT(*) FILTER (WHERE status = 'closed'),
    'total',   COUNT(*),
    'avg_first_reply_hours',
      ROUND(EXTRACT(epoch FROM AVG(first_reply_at - created_at)) / 3600)::INT,
    'unanswered_over_24h',
      COUNT(*) FILTER (
        WHERE status = 'open'
        AND created_at < now() - interval '24 hours'
        AND first_reply_at IS NULL
      ),
    'by_category', '{}'::json
  ) INTO result FROM public.support_tickets;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_support_stats() TO authenticated;


-- ─── B. admin_team ───────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_team();
CREATE OR REPLACE FUNCTION public.admin_team()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT json_build_object(
    'membres', COALESCE(
      (
        SELECT json_agg(row_to_json(m))
        FROM (
          SELECT
            sr.user_id AS id,
            CONCAT(COALESCE(p.first_name,''),' ',COALESCE(p.last_name,'')) AS nom,
            sr.role,
            (p.photos->>0) AS photo,
            sr.updated_at AS created_at,
            p.last_seen,
            CASE sr.role
              WHEN 'admin'     THEN ARRAY['users','moderation','content','support','analytics','marketing','settings','team']
              WHEN 'moderator' THEN ARRAY['users','moderation','content']
              WHEN 'support'   THEN ARRAY['users','support']
              WHEN 'redacteur' THEN ARRAY['content']
              ELSE ARRAY[]::TEXT[]
            END AS permissions,
            (SELECT COUNT(*) FROM public.admin_access_log al
             WHERE al.admin_id = sr.user_id AND al.action = 'read_conversation') AS consultations
          FROM public.staff_roles sr
          JOIN public.profiles p ON sr.user_id = p.id
          WHERE sr.role != 'member'
          ORDER BY CASE sr.role
            WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2
            WHEN 'support' THEN 3 WHEN 'redacteur' THEN 4 ELSE 5 END, sr.updated_at DESC
        ) m
      ), '[]'::json
    )
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_team() TO authenticated;


-- ─── C. admin_search_member ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_search_member(TEXT);
CREATE OR REPLACE FUNCTION public.admin_search_member(p_query TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  RETURN COALESCE(
    (SELECT json_agg(row_to_json(r)) FROM (
      SELECT p.id,
        CONCAT(COALESCE(p.first_name,''),' ',COALESCE(p.last_name,'')) AS nom,
        p.city AS ville,
        (p.photos->>0) AS photo,
        COALESCE(sr.role,'member') AS role
      FROM public.profiles p
      LEFT JOIN public.staff_roles sr ON sr.user_id = p.id
      WHERE p.first_name ILIKE '%'||p_query||'%'
         OR p.last_name  ILIKE '%'||p_query||'%'
         OR p.city       ILIKE '%'||p_query||'%'
      LIMIT 10
    ) r),
    '[]'::json
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_search_member(TEXT) TO authenticated;


-- ─── D. admin_set_role ───────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_set_role(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id UUID, p_role TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_caller_role TEXT; v_admin_count INT;
BEGIN
  SELECT role INTO v_caller_role FROM public.staff_roles WHERE user_id = auth.uid();
  IF v_caller_role != 'admin' THEN RETURN json_build_object('ok',false,'reason','forbidden'); END IF;
  IF p_user_id = auth.uid() THEN RETURN json_build_object('ok',false,'reason','soi_meme'); END IF;
  IF p_role = 'member' OR p_role IS NULL THEN
    SELECT COUNT(*) INTO v_admin_count FROM public.staff_roles WHERE role='admin' AND user_id!=p_user_id;
    IF v_admin_count = 0 THEN RETURN json_build_object('ok',false,'reason','dernier_admin'); END IF;
  END IF;
  IF p_role IS NULL OR p_role = 'member' THEN
    DELETE FROM public.staff_roles WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.staff_roles(user_id,role,updated_at) VALUES(p_user_id,p_role,now())
    ON CONFLICT(user_id) DO UPDATE SET role=p_role, updated_at=now();
  END IF;
  RETURN json_build_object('ok',true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_role(UUID, TEXT) TO authenticated;


-- ─── E. admin_pending_posts ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_pending_posts(INT);
CREATE OR REPLACE FUNCTION public.admin_pending_posts(p_limit INT DEFAULT 100)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_mod_active BOOLEAN;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT (value#>>'{}')::BOOLEAN INTO v_mod_active FROM public.app_settings WHERE key='community_moderation';
  RETURN json_build_object(
    'moderation_active', COALESCE(v_mod_active, false),
    'en_attente', (SELECT COUNT(*) FROM public.community_posts WHERE status='pending'),
    'rejetes', (SELECT COUNT(*) FROM public.community_posts WHERE status='rejected'),
    'posts', COALESCE(
      (SELECT json_agg(row_to_json(r) ORDER BY r.created_at ASC) FROM (
        SELECT cp.id, cp.text, cp.image_url, cp.video_url, cp.category, cp.status, cp.created_at,
          CONCAT(COALESCE(p.first_name,''),' ',COALESCE(p.last_name,'')) AS auteur,
          (p.photos->>0) AS auteur_photo,
          (SELECT COUNT(*) FROM public.community_reports cr WHERE cr.post_id=cp.id) AS signalements
        FROM public.community_posts cp JOIN public.profiles p ON cp.user_id=p.id
        WHERE cp.status='pending' LIMIT p_limit
      ) r), '[]'::json
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_pending_posts(INT) TO authenticated;


-- ─── F. admin_post_reports ───────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_post_reports(INT);
CREATE OR REPLACE FUNCTION public.admin_post_reports(p_limit INT DEFAULT 100)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  RETURN json_build_object(
    'en_attente', (SELECT COUNT(DISTINCT post_id) FROM public.community_reports WHERE status='pending'),
    'signalements', COALESCE(
      (SELECT json_agg(row_to_json(r) ORDER BY r.created_at DESC) FROM (
        SELECT cr.id, cr.reason, cr.created_at, cr.status,
          COALESCE(rp.first_name,'Membre') AS signalant,
          (SELECT COUNT(*) FROM public.community_reports cr2 WHERE cr2.post_id=cr.post_id) AS nb_signalements,
          CASE WHEN cp.id IS NULL THEN NULL ELSE
            json_build_object(
              'id', cp.id, 'text', cp.text, 'image_url', cp.image_url,
              'video_url', cp.video_url, 'category', cp.category, 'status', cp.status,
              'auteur', CONCAT(COALESCE(ap.first_name,''),' ',COALESCE(ap.last_name,''))
            )
          END AS post
        FROM public.community_reports cr
        LEFT JOIN public.profiles rp ON cr.reporter_id=rp.id
        LEFT JOIN public.community_posts cp ON cr.post_id=cp.id
        LEFT JOIN public.profiles ap ON cp.user_id=ap.id
        WHERE cr.status='pending'
        ORDER BY cr.created_at DESC LIMIT p_limit
      ) r), '[]'::json
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_post_reports(INT) TO authenticated;


-- ─── G. admin_review_post ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_review_post(UUID, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.admin_review_post(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.admin_review_post(
  p_post_id UUID, p_approve BOOLEAN, p_reason TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF p_approve THEN
    UPDATE public.community_posts SET status='published' WHERE id=p_post_id;
  ELSE
    UPDATE public.community_posts SET status='rejected', rejection_reason=p_reason WHERE id=p_post_id;
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_review_post(UUID, BOOLEAN, TEXT) TO authenticated;


-- ─── H. admin_review_post_report ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_review_post_report(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.admin_review_post_report(p_report_id UUID, p_action TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_post_id UUID;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT post_id INTO v_post_id FROM public.community_reports WHERE id=p_report_id;
  IF NOT FOUND THEN RETURN json_build_object('ok',false,'reason','not_found'); END IF;
  CASE p_action
    WHEN 'dismiss' THEN
      UPDATE public.community_reports SET status='dismissed' WHERE post_id=v_post_id;
    WHEN 'hide' THEN
      UPDATE public.community_posts SET status='rejected' WHERE id=v_post_id;
      UPDATE public.community_reports SET status='resolved' WHERE post_id=v_post_id;
    WHEN 'delete' THEN
      DELETE FROM public.community_posts WHERE id=v_post_id;
    ELSE RETURN json_build_object('ok',false,'reason','unknown_action');
  END CASE;
  RETURN json_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_review_post_report(UUID, TEXT) TO authenticated;


-- ─── I. admin_conversations ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_conversations(TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.admin_conversations(INT);
CREATE OR REPLACE FUNCTION public.admin_conversations(
  p_filter TEXT DEFAULT 'active',
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 100,
  p_offset INT  DEFAULT 0
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  RETURN json_build_object(
    'total', (SELECT COUNT(*) FROM public.matches),
    'conversations', COALESCE(
      (SELECT json_agg(row_to_json(r)) FROM (
        SELECT m.id AS match_id,
          json_build_array(
            json_build_object('id',p1.id,'nom',CONCAT(COALESCE(p1.first_name,''),' ',COALESCE(p1.last_name,'')),'photo',(p1.photos->>0)),
            json_build_object('id',p2.id,'nom',CONCAT(COALESCE(p2.first_name,''),' ',COALESCE(p2.last_name,'')),'photo',(p2.photos->>0))
          ) AS participants,
          (SELECT msg.content FROM public.messages msg WHERE msg.match_id=m.id ORDER BY msg.created_at DESC LIMIT 1) AS dernier_msg,
          (SELECT COUNT(*) FROM public.messages msg WHERE msg.match_id=m.id) AS nb_messages,
          m.created_at,
          (SELECT MAX(msg.created_at) FROM public.messages msg WHERE msg.match_id=m.id) AS last_message_at,
          false AS signalee, NULL::TEXT AS motif
        FROM public.matches m
        JOIN public.profiles p1 ON m.user1_id=p1.id
        JOIN public.profiles p2 ON m.user2_id=p2.id
        WHERE (p_search IS NULL
          OR p1.first_name ILIKE '%'||p_search||'%' OR p2.first_name ILIKE '%'||p_search||'%'
          OR p1.last_name  ILIKE '%'||p_search||'%' OR p2.last_name  ILIKE '%'||p_search||'%')
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT p_limit OFFSET p_offset
      ) r), '[]'::json
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_conversations(TEXT, TEXT, INT, INT) TO authenticated;


-- ─── J. admin_access_history ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_access_history(INT);
CREATE OR REPLACE FUNCTION public.admin_access_history(p_limit INT DEFAULT 200)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  RETURN COALESCE(
    (SELECT json_agg(row_to_json(r)) FROM (
      SELECT al.id,
        CONCAT(COALESCE(p.first_name,''),' ',COALESCE(p.last_name,'')) AS admin_nom,
        al.action, al.target_id, al.motif, al.created_at
      FROM public.admin_access_log al
      JOIN public.profiles p ON al.admin_id=p.id
      ORDER BY al.created_at DESC LIMIT p_limit
    ) r), '[]'::json
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_access_history(INT) TO authenticated;


-- ─── K. admin_read_conversation ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_read_conversation(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_read_conversation(TEXT);
CREATE OR REPLACE FUNCTION public.admin_read_conversation(p_match_id UUID, p_motif TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  INSERT INTO public.admin_access_log(admin_id, action, target_id, motif)
  VALUES(auth.uid(), 'read_conversation', p_match_id::TEXT, p_motif);
  SELECT json_build_object(
    'messages', COALESCE(
      (SELECT json_agg(row_to_json(r) ORDER BY r.created_at ASC) FROM (
        SELECT msg.id, msg.sender_id, msg.content, msg.type, msg.media_url, msg.read_at, msg.created_at,
          CONCAT(COALESCE(p.first_name,''),' ',COALESCE(p.last_name,'')) AS sender_nom,
          (p.photos->>0) AS sender_photo
        FROM public.messages msg
        JOIN public.profiles p ON msg.sender_id=p.id
        WHERE msg.match_id=p_match_id
      ) r), '[]'::json
    )
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_read_conversation(UUID, TEXT) TO authenticated;


-- ─── L. admin_departures ─────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_departures(INT);
CREATE OR REPLACE FUNCTION public.admin_departures(p_limit INT DEFAULT 100)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  RETURN json_build_object(
    'total',       (SELECT COUNT(*) FROM public.account_deletions),
    'total_30d',   (SELECT COUNT(*) FROM public.account_deletions WHERE deleted_at >= now()-interval'30 days'),
    'succes',      0, 'payants_perdus', 0, 'jours_actif_median', NULL,
    'par_motif', COALESCE(
      (SELECT json_agg(row_to_json(r) ORDER BY r.n DESC) FROM (
        SELECT COALESCE(reason,'non précisé') AS motif, COUNT(*) AS n, 0 AS payants, NULL::INT AS jours_moyen
        FROM public.account_deletions GROUP BY reason
      ) r), '[]'::json
    ),
    'recents', COALESCE(
      (SELECT json_agg(row_to_json(r) ORDER BY r.created_at DESC) FROM (
        SELECT d.id, COALESCE(d.reason,'non précisé') AS motif, d.details,
          NULL::INT AS jours_actif, false AS avait_paye,
          NULL::TEXT AS pays, NULL::TEXT AS genre, 0 AS nb_matchs, 0 AS nb_messages,
          d.deleted_at AS created_at
        FROM public.account_deletions d ORDER BY d.deleted_at DESC LIMIT p_limit
      ) r), '[]'::json
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_departures(INT) TO authenticated;


-- ─── M. admin_meta_ads ───────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_meta_ads(INT);
CREATE OR REPLACE FUNCTION public.admin_meta_ads(p_days INT DEFAULT 30)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pixel_id TEXT; v_budget NUMERIC;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT (value#>>'{}') INTO v_pixel_id FROM public.app_settings WHERE key='meta_pixel_id';
  SELECT (value#>>'{}')::NUMERIC INTO v_budget FROM public.app_settings WHERE key='meta_budget_quotidien';
  RETURN json_build_object(
    'pixel_id', v_pixel_id, 'budget_quotidien', COALESCE(v_budget,0),
    'depense_periode',0,'cpm',0,'ctr',0,'cpc',0,'impressions',0,'clics',0,
    'installations', (SELECT COUNT(*) FROM public.install_stats WHERE created_at>=now()-(p_days||' days')::interval),
    'cout_installation',0,
    'inscriptions', (SELECT COUNT(*) FROM public.profiles WHERE created_at>=now()-(p_days||' days')::interval),
    'cout_inscription',0,'abonnements',0,'revenus',0,'roas',0,'series','[]'::json
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_meta_ads(INT) TO authenticated;


-- ─── N. admin_grant_days ─────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_grant_days(UUID, INT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_grant_days(
  p_user_id UUID, p_days INT, p_reason TEXT DEFAULT NULL, p_plan TEXT DEFAULT 'premium'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_until TIMESTAMPTZ;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF p_days<=0 OR p_days>3650 THEN RETURN json_build_object('ok',false,'reason','invalid_days'); END IF;
  UPDATE public.profiles
  SET premium_until=GREATEST(COALESCE(premium_until,now()),now())+(p_days||' days')::interval,
      public_plan=p_plan
  WHERE id=p_user_id RETURNING premium_until INTO v_new_until;
  IF NOT FOUND THEN RETURN json_build_object('ok',false,'reason','user_not_found'); END IF;
  INSERT INTO public.admin_access_log(admin_id,action,target_id,motif)
  VALUES(auth.uid(),'grant_days',p_user_id::TEXT,COALESCE(p_reason,'Geste commercial'));
  RETURN json_build_object('ok',true,'expires_at',v_new_until);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_grant_days(UUID, INT, TEXT, TEXT) TO authenticated;


-- ─── O. admin_suspend_user ───────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_suspend_user(UUID, TEXT, INT);
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_user_id UUID, p_reason TEXT, p_days INT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_until TIMESTAMPTZ; v_permanent BOOLEAN;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF p_days IS NULL OR p_days>3650 THEN
    v_until:=now()+interval'9999 days'; v_permanent:=true;
  ELSE
    v_until:=now()+(p_days||' days')::interval; v_permanent:=false;
  END IF;
  UPDATE public.profiles SET suspended_until=v_until, suspension_reason=p_reason WHERE id=p_user_id;
  INSERT INTO public.admin_access_log(admin_id,action,target_id,motif)
  VALUES(auth.uid(),'suspend_user',p_user_id::TEXT,p_reason);
  RETURN json_build_object('ok',true,'until',v_until,'permanent',v_permanent);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(UUID, TEXT, INT) TO authenticated;


-- ─── P. admin_unsuspend_user ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_unsuspend_user(UUID);
CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  UPDATE public.profiles SET suspended_until=NULL, suspension_reason=NULL WHERE id=p_user_id;
  INSERT INTO public.admin_access_log(admin_id,action,target_id,motif)
  VALUES(auth.uid(),'unsuspend_user',p_user_id::TEXT,'Suspension levée');
  RETURN json_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend_user(UUID) TO authenticated;


-- ─── Vérification finale ──────────────────────────────────────────────────────
SELECT proname AS fonction, pronargs AS nb_args
FROM pg_proc
WHERE proname LIKE 'admin_%'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;
