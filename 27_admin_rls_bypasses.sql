-- ==============================================================================
-- 27_admin_rls_bypasses.sql
-- Accès complet pour les administrateurs sur toutes les tables du dashboard.
-- À exécuter dans Supabase → SQL Editor (une seule fois)
-- ==============================================================================

-- ─── profiles ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_profiles_select"  ON public.profiles;
DROP POLICY IF EXISTS "admin_profiles_update"  ON public.profiles;
DROP POLICY IF EXISTS "admin_profiles_delete"  ON public.profiles;

CREATE POLICY "admin_profiles_select"
  ON public.profiles FOR SELECT
  USING (public.is_staff() OR auth.uid() = id);

CREATE POLICY "admin_profiles_update"
  ON public.profiles FOR UPDATE
  USING (public.is_staff() OR auth.uid() = id);

CREATE POLICY "admin_profiles_delete"
  ON public.profiles FOR DELETE
  USING (public.is_staff() OR auth.uid() = id);

-- ─── matches ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_matches_select" ON public.matches;
DROP POLICY IF EXISTS "admin_matches_delete" ON public.matches;

CREATE POLICY "admin_matches_select"
  ON public.matches FOR SELECT
  USING (public.is_staff() OR auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "admin_matches_delete"
  ON public.matches FOR DELETE
  USING (public.is_staff());

-- ─── messages ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_messages_select" ON public.messages;
DROP POLICY IF EXISTS "admin_messages_delete" ON public.messages;

CREATE POLICY "admin_messages_select"
  ON public.messages FOR SELECT
  USING (
    public.is_staff()
    OR auth.uid() IN (
      SELECT m.user1_id FROM public.matches m WHERE m.id = match_id
      UNION
      SELECT m.user2_id FROM public.matches m WHERE m.id = match_id
    )
  );

CREATE POLICY "admin_messages_delete"
  ON public.messages FOR DELETE
  USING (public.is_staff());

-- ─── reports ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_reports_select" ON public.reports;
DROP POLICY IF EXISTS "admin_reports_update" ON public.reports;

CREATE POLICY "admin_reports_select"
  ON public.reports FOR SELECT
  USING (public.is_staff() OR reporter_id = auth.uid());

CREATE POLICY "admin_reports_update"
  ON public.reports FOR UPDATE
  USING (public.is_staff());

-- ─── payments ─────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_payments_select"  ON public.payments;
DROP POLICY IF EXISTS "users_payments_select"  ON public.payments;

CREATE POLICY "users_payments_select"
  ON public.payments FOR SELECT
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "admin_payments_update"
  ON public.payments FOR UPDATE
  USING (public.is_staff());

-- ─── campaigns (marketing) ────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_campaigns_all" ON public.campaigns;

CREATE POLICY "admin_campaigns_all"
  ON public.campaigns FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ─── blog_posts (contenus) ────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_blog_posts_all"   ON public.blog_posts;
DROP POLICY IF EXISTS "public_blog_posts_read" ON public.blog_posts;

CREATE POLICY "public_blog_posts_read"
  ON public.blog_posts FOR SELECT
  USING (status = 'published' OR public.is_staff());

CREATE POLICY "admin_blog_posts_all"
  ON public.blog_posts FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ─── app_settings ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_app_settings_all" ON public.app_settings;

CREATE POLICY "admin_app_settings_all"
  ON public.app_settings FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ─── support_messages ─────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_support_messages_all"  ON public.support_messages;
DROP POLICY IF EXISTS "users_support_messages_own"  ON public.support_messages;

CREATE POLICY "users_support_messages_own"
  ON public.support_messages FOR ALL
  USING (
    public.is_staff()
    OR sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR sender_id = auth.uid()
  );

-- ─── staff_roles ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_staff_roles_all" ON public.staff_roles;

CREATE POLICY "admin_staff_roles_all"
  ON public.staff_roles FOR ALL
  USING (public.is_staff() OR user_id = auth.uid())
  WITH CHECK (public.is_staff());

-- ─── swipes ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_swipes_select" ON public.swipes;

CREATE POLICY "admin_swipes_select"
  ON public.swipes FOR SELECT
  USING (public.is_staff() OR auth.uid() = actor_id OR auth.uid() = target_id);

-- ─── Vérification finale ──────────────────────────────────────────────────────
-- Doit retourner true si tu es connecté avec ton compte admin
SELECT public.is_staff() AS "je_suis_admin";
