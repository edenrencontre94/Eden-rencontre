-- ============================================================
-- Réglages applicatifs et campagnes e-mail
-- ============================================================
-- La page Paramètres affichait déjà les bons réglages — mode maintenance,
-- inscriptions, quotas — mais aucun n'était enregistré ni lu. Un panneau
-- de configuration qui ne configure rien est pire qu'absent : on croit
-- avoir agi.
--
-- Cette migration rend chaque réglage EFFECTIF : les fonctions de quota
-- existantes vont désormais lire ces valeurs au lieu de les coder en dur.

-- ------------------------------------------------------------
-- 1. Table des réglages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  label text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Certains réglages doivent être lisibles par l'application elle-même
-- (mode maintenance, inscriptions ouvertes) : la lecture est donc ouverte.
-- Aucune donnée personnelle n'y figure.
DROP POLICY IF EXISTS "Settings are readable" ON public.app_settings;
CREATE POLICY "Settings are readable"
ON public.app_settings FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins update settings" ON public.app_settings;
CREATE POLICY "Admins update settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins insert settings" ON public.app_settings;
CREATE POLICY "Admins insert settings"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

INSERT INTO public.app_settings (key, value, label) VALUES
  ('maintenance_mode',             'false'::jsonb, 'Mode maintenance'),
  ('registration_open',            'true'::jsonb,  'Inscriptions ouvertes'),
  ('free_messages_per_day',        '5'::jsonb,     'Messages par jour — formule Gratuite'),
  ('free_likes_per_day',           '25'::jsonb,    'Likes par jour — formule Gratuite'),
  ('free_superlike_cooldown_days', '7'::jsonb,     'Délai entre deux Super Likes — Gratuit'),
  ('boost_duration_minutes',       '30'::jsonb,    'Durée du Boost inclus (minutes)'),
  ('email_daily_cap',              '3'::jsonb,     'E-mails facultatifs par jour et par membre')
ON CONFLICT (key) DO NOTHING;

-- Lecture typée, avec repli si la clé venait à manquer
CREATE OR REPLACE FUNCTION public.setting_int(p_key text, p_default integer)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value)::text::integer FROM public.app_settings WHERE key = p_key), p_default);
$$;

CREATE OR REPLACE FUNCTION public.setting_bool(p_key text, p_default boolean)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value)::text::boolean FROM public.app_settings WHERE key = p_key), p_default);
$$;

-- ------------------------------------------------------------
-- 2. Les quotas lisent maintenant ces réglages
-- ------------------------------------------------------------
-- C'est ce qui rend la page Paramètres réelle : modifier la valeur change
-- immédiatement le comportement, sans redéploiement.
CREATE OR REPLACE FUNCTION public.quota_messages(p_level smallint)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p_level
    WHEN 0 THEN public.setting_int('free_messages_per_day', 5)
    WHEN 1 THEN 20
    WHEN 2 THEN 35
    WHEN 3 THEN 55
    ELSE -1
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_swipe_limits()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan     text;
  v_count    integer;
  v_last     timestamp with time zone;
  v_max      integer;
  v_cooldown integer;
BEGIN
  v_plan := public.effective_plan(NEW.swiper_id);
  IF v_plan <> 'gratuit' THEN RETURN NEW; END IF;

  IF NEW.action = 'superlike' THEN
    v_cooldown := public.setting_int('free_superlike_cooldown_days', 7);

    SELECT max(s.created_at) INTO v_last
    FROM public.swipes s
    WHERE s.swiper_id = NEW.swiper_id AND s.action = 'superlike';

    IF v_last IS NOT NULL
       AND v_last > timezone('utc'::text, now()) - make_interval(days => v_cooldown) THEN
      RAISE EXCEPTION 'FREE_SUPERLIKE_COOLDOWN'
        USING HINT = 'Un Super Like tous les ' || v_cooldown || ' jours en formule Gratuite.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.action = 'like' THEN
    v_max := public.setting_int('free_likes_per_day', 25);

    SELECT count(*) INTO v_count
    FROM public.swipes s
    WHERE s.swiper_id = NEW.swiper_id
      AND s.action = 'like'
      AND s.created_at >= date_trunc('day', timezone('utc'::text, now()));

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'FREE_LIKE_QUOTA'
        USING HINT = 'Quota de ' || v_max || ' likes quotidiens atteint.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- La durée du Boost devient réglable
CREATE OR REPLACE FUNCTION public.start_boost()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_now     timestamp with time zone := timezone('utc'::text, now());
  v_level   smallint;
  v_plan    text;
  v_quota   integer;
  v_used    integer;
  v_active  timestamp with time zone;
  v_expires timestamp with time zone;
  v_minutes integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  v_plan := public.effective_plan(v_user);
  v_level := public.effective_level(v_user);
  v_quota := public.quota_boosts(v_level);

  IF v_quota = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan', 'plan', v_plan);
  END IF;

  SELECT p.boosted_until INTO v_active FROM public.profiles p WHERE p.id = v_user;
  IF v_active IS NOT NULL AND v_active > v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'expires_at', v_active);
  END IF;

  IF v_quota > 0 THEN
    SELECT count(*) INTO v_used
    FROM public.boosts b
    WHERE b.user_id = v_user AND b.source = 'plan'
      AND b.started_at >= date_trunc('month', v_now);

    IF v_used >= v_quota THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'quota', 'used', v_used, 'quota', v_quota);
    END IF;
  END IF;

  v_minutes := public.setting_int('boost_duration_minutes', 30);
  v_expires := v_now + make_interval(mins => v_minutes);

  INSERT INTO public.boosts (user_id, plan_id, started_at, expires_at, source)
  VALUES (v_user, v_plan, v_now, v_expires, 'plan');

  UPDATE public.profiles SET boosted_until = v_expires WHERE id = v_user;

  RETURN jsonb_build_object('ok', true, 'expires_at', v_expires, 'plan', v_plan, 'minutes', v_minutes);
END;
$$;

REVOKE ALL ON FUNCTION public.start_boost() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_boost() FROM anon;
GRANT EXECUTE ON FUNCTION public.start_boost() TO authenticated;

-- ------------------------------------------------------------
-- 3. Campagnes e-mail
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  recipients integer DEFAULT 0,
  delivered integer DEFAULT 0,
  skipped integer DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  sent_at timestamp with time zone
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage campaigns" ON public.campaigns;
CREATE POLICY "Admins manage campaigns"
ON public.campaigns FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 4. Statistiques e-mail pour le back-office
-- ------------------------------------------------------------
-- Regroupées en une seule fonction plutôt qu'en dix requêtes : la page
-- se charge d'un coup, et les règles d'agrégation restent au même endroit.
CREATE OR REPLACE FUNCTION public.admin_email_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamp with time zone := timezone('utc'::text, now());
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'total_members',      (SELECT count(*) FROM public.profiles),
    'opted_in_marketing', (SELECT count(*) FROM public.email_preferences WHERE marketing),
    'opted_in_matches',   (SELECT count(*) FROM public.email_preferences WHERE matches),
    'opted_in_messages',  (SELECT count(*) FROM public.email_preferences WHERE messages),
    'suppressed',         (SELECT count(*) FROM public.email_suppression),
    'bounces',            (SELECT count(*) FROM public.email_suppression WHERE reason = 'bounce'),
    'complaints',         (SELECT count(*) FROM public.email_suppression WHERE reason = 'complaint'),
    'sent_total',         (SELECT count(*) FROM public.email_log),
    'sent_7d',            (SELECT count(*) FROM public.email_log WHERE sent_at >= v_now - interval '7 days'),
    'sent_30d',           (SELECT count(*) FROM public.email_log WHERE sent_at >= v_now - interval '30 days'),
    'by_category',        (SELECT COALESCE(jsonb_object_agg(category, n), '{}'::jsonb)
                           FROM (SELECT category, count(*) AS n FROM public.email_log GROUP BY category) x)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_email_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_email_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_email_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 5. Contrôle
-- ------------------------------------------------------------
SELECT key, value, label FROM public.app_settings ORDER BY key;
