-- ============================================================
-- Quotas réglables par palier, et réglages étendus
-- ============================================================
-- La migration 32 n'avait rendu réglable que la formule Gratuite : les
-- valeurs Premium et VIP restaient codées en dur dans les fonctions.
-- Tout devient paramétrable, palier par palier.
--
-- Paliers : 0 = Gratuit, 1 = Premium 15 j, 2 = Premium 1 mois,
--           3 = Premium 3 mois, 4 = VIP.  (-1 = illimité partout)
--
-- Deux principes tenus ici :
--
-- 1. UNE SEULE SOURCE DE VÉRITÉ. Les clés globales posées par la 32
--    (free_messages_per_day, boost_duration_minutes…) sont reportées dans
--    les clés par palier PUIS SUPPRIMÉES. Deux champs qui pilotent la même
--    chose, c'est la garantie qu'un jour les deux se contrediront.
--
-- 2. AUCUN RÉGLAGE DÉCORATIF. Chaque clé ajoutée ici est lue par une
--    fonction ou un trigger. `email_daily_cap`, introduite par la 32,
--    n'était en réalité lue nulle part : c'est corrigé plus bas.

-- ------------------------------------------------------------
-- 1. Lecture typée du texte (les entiers et booléens existent déjà)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.setting_text(p_key text, p_default text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT value #>> '{}' FROM public.app_settings WHERE key = p_key),
    p_default
  );
$$;

-- ------------------------------------------------------------
-- 2. Les clés, palier par palier
-- ------------------------------------------------------------
-- Nommage `<quota>_l<palier>` : les fonctions composent la clé au lieu
-- d'énumérer cinq branches, et ajouter un palier ne demandera rien.

INSERT INTO public.app_settings (key, value, label) VALUES
  -- Messages envoyés par jour
  ('quota_messages_l0', '5'::jsonb,   'Messages/jour — Gratuit'),
  ('quota_messages_l1', '20'::jsonb,  'Messages/jour — Premium 15 jours'),
  ('quota_messages_l2', '35'::jsonb,  'Messages/jour — Premium 1 mois'),
  ('quota_messages_l3', '55'::jsonb,  'Messages/jour — Premium 3 mois'),
  ('quota_messages_l4', '-1'::jsonb,  'Messages/jour — VIP'),

  -- Likes par jour
  ('quota_likes_l0', '25'::jsonb, 'Likes/jour — Gratuit'),
  ('quota_likes_l1', '-1'::jsonb, 'Likes/jour — Premium 15 jours'),
  ('quota_likes_l2', '-1'::jsonb, 'Likes/jour — Premium 1 mois'),
  ('quota_likes_l3', '-1'::jsonb, 'Likes/jour — Premium 3 mois'),
  ('quota_likes_l4', '-1'::jsonb, 'Likes/jour — VIP'),

  -- Super Likes par jour
  ('quota_superlikes_l0', '1'::jsonb,  'Super Likes/jour — Gratuit'),
  ('quota_superlikes_l1', '5'::jsonb,  'Super Likes/jour — Premium 15 jours'),
  ('quota_superlikes_l2', '5'::jsonb,  'Super Likes/jour — Premium 1 mois'),
  ('quota_superlikes_l3', '5'::jsonb,  'Super Likes/jour — Premium 3 mois'),
  ('quota_superlikes_l4', '-1'::jsonb, 'Super Likes/jour — VIP'),

  -- Délai entre deux Super Likes, en jours. 0 = pas de délai, et c'est
  -- alors le quota journalier ci-dessus qui s'applique.
  ('superlike_cooldown_l0', '7'::jsonb, 'Délai Super Like (jours) — Gratuit'),
  ('superlike_cooldown_l1', '0'::jsonb, 'Délai Super Like (jours) — Premium 15 jours'),
  ('superlike_cooldown_l2', '0'::jsonb, 'Délai Super Like (jours) — Premium 1 mois'),
  ('superlike_cooldown_l3', '0'::jsonb, 'Délai Super Like (jours) — Premium 3 mois'),
  ('superlike_cooldown_l4', '0'::jsonb, 'Délai Super Like (jours) — VIP'),

  -- Boosts inclus par mois
  ('quota_boosts_l0', '0'::jsonb,  'Boosts inclus/mois — Gratuit'),
  ('quota_boosts_l1', '1'::jsonb,  'Boosts inclus/mois — Premium 15 jours'),
  ('quota_boosts_l2', '2'::jsonb,  'Boosts inclus/mois — Premium 1 mois'),
  ('quota_boosts_l3', '4'::jsonb,  'Boosts inclus/mois — Premium 3 mois'),
  ('quota_boosts_l4', '-1'::jsonb, 'Boosts inclus/mois — VIP'),

  -- Durée d'un Boost inclus, en minutes (sans effet sur les Boosts achetés)
  ('boost_minutes_l0', '0'::jsonb,  'Durée Boost inclus (min) — Gratuit'),
  ('boost_minutes_l1', '30'::jsonb, 'Durée Boost inclus (min) — Premium 15 jours'),
  ('boost_minutes_l2', '30'::jsonb, 'Durée Boost inclus (min) — Premium 1 mois'),
  ('boost_minutes_l3', '30'::jsonb, 'Durée Boost inclus (min) — Premium 3 mois'),
  ('boost_minutes_l4', '60'::jsonb, 'Durée Boost inclus (min) — VIP'),

  -- Palier minimum requis pour chaque fonctionnalité
  ('min_level_voice_message', '1'::jsonb, 'Palier mini — message vocal'),
  ('min_level_video_message', '4'::jsonb, 'Palier mini — vidéo en conversation'),
  ('min_level_audio_call',    '1'::jsonb, 'Palier mini — appel audio'),
  ('min_level_video_call',    '4'::jsonb, 'Palier mini — appel vidéo'),
  ('min_level_post_image',    '1'::jsonb, 'Palier mini — photo en communauté'),
  ('min_level_post_video',    '4'::jsonb, 'Palier mini — vidéo en communauté'),

  -- Message affiché pendant la maintenance
  ('maintenance_message',
   '"Nous améliorons AgapeMeet en ce moment même. L''application sera de nouveau accessible d''ici peu — vos conversations et votre profil sont intacts."'::jsonb,
   'Message affiché en maintenance')
ON CONFLICT (key) DO NOTHING;

-- Report des anciennes valeurs globales vers les clés par palier.
-- Si vous aviez déjà ajusté un quota dans /admin/parametres, ce réglage
-- est conservé — il aurait été silencieusement perdu sinon.
UPDATE public.app_settings s SET value = old.value
FROM public.app_settings old
WHERE old.key = 'free_messages_per_day' AND s.key = 'quota_messages_l0';

UPDATE public.app_settings s SET value = old.value
FROM public.app_settings old
WHERE old.key = 'free_likes_per_day' AND s.key = 'quota_likes_l0';

UPDATE public.app_settings s SET value = old.value
FROM public.app_settings old
WHERE old.key = 'free_superlike_cooldown_days' AND s.key = 'superlike_cooldown_l0';

UPDATE public.app_settings s SET value = old.value
FROM public.app_settings old
WHERE old.key = 'boost_duration_minutes' AND s.key IN ('boost_minutes_l1','boost_minutes_l2','boost_minutes_l3');

DELETE FROM public.app_settings
WHERE key IN ('free_messages_per_day', 'free_likes_per_day',
              'free_superlike_cooldown_days', 'boost_duration_minutes');

-- ------------------------------------------------------------
-- 3. Les fonctions de quota lisent les clés par palier
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quota_messages(p_level smallint)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.setting_int(
    'quota_messages_l' || p_level::text,
    CASE p_level WHEN 0 THEN 5 WHEN 1 THEN 20 WHEN 2 THEN 35 WHEN 3 THEN 55 ELSE -1 END
  );
$$;

CREATE OR REPLACE FUNCTION public.quota_boosts(p_level smallint)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.setting_int(
    'quota_boosts_l' || p_level::text,
    CASE p_level WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 4 ELSE -1 END
  );
$$;

CREATE OR REPLACE FUNCTION public.quota_likes(p_level smallint)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.setting_int(
    'quota_likes_l' || p_level::text,
    CASE p_level WHEN 0 THEN 25 ELSE -1 END
  );
$$;

CREATE OR REPLACE FUNCTION public.quota_superlikes(p_level smallint)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.setting_int(
    'quota_superlikes_l' || p_level::text,
    CASE p_level WHEN 0 THEN 1 WHEN 4 THEN -1 ELSE 5 END
  );
$$;

CREATE OR REPLACE FUNCTION public.superlike_cooldown(p_level smallint)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.setting_int(
    'superlike_cooldown_l' || p_level::text,
    CASE p_level WHEN 0 THEN 7 ELSE 0 END
  );
$$;

-- ------------------------------------------------------------
-- 4. Swipes : quotas appliqués à TOUS les paliers
-- ------------------------------------------------------------
-- L'ancienne version sortait immédiatement dès que le membre n'était pas
-- gratuit — les réglages Premium n'auraient donc rien piloté.
CREATE OR REPLACE FUNCTION public.enforce_swipe_limits()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_level    smallint;
  v_count    integer;
  v_last     timestamp with time zone;
  v_max      integer;
  v_cooldown integer;
BEGIN
  v_level := public.effective_level(NEW.swiper_id);

  IF NEW.action = 'superlike' THEN
    v_cooldown := public.superlike_cooldown(v_level);

    -- Un délai l'emporte sur le quota journalier : c'est le modèle de la
    -- formule Gratuite (un Super Like tous les 7 jours).
    IF v_cooldown > 0 THEN
      SELECT max(s.created_at) INTO v_last
      FROM public.swipes s
      WHERE s.swiper_id = NEW.swiper_id AND s.action = 'superlike';

      IF v_last IS NOT NULL
         AND v_last > timezone('utc'::text, now()) - make_interval(days => v_cooldown) THEN
        RAISE EXCEPTION 'FREE_SUPERLIKE_COOLDOWN'
          USING HINT = 'Un Super Like tous les ' || v_cooldown || ' jours pour votre formule.';
      END IF;

      RETURN NEW;
    END IF;

    v_max := public.quota_superlikes(v_level);
    IF v_max = -1 THEN RETURN NEW; END IF;

    SELECT count(*) INTO v_count
    FROM public.swipes s
    WHERE s.swiper_id = NEW.swiper_id
      AND s.action = 'superlike'
      AND s.created_at >= date_trunc('day', timezone('utc'::text, now()));

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'SUPERLIKE_QUOTA'
        USING HINT = 'Quota de ' || v_max || ' Super Likes quotidiens atteint.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.action = 'like' THEN
    v_max := public.quota_likes(v_level);
    IF v_max = -1 THEN RETURN NEW; END IF;

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

-- ------------------------------------------------------------
-- 5. Messages, appels, communauté : paliers minimum réglables
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_message_limits()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_level smallint;
  v_quota integer;
  v_sent  integer;
BEGIN
  v_level := public.effective_level(NEW.sender_id);

  IF NEW.media_type = 'audio'
     AND v_level < public.setting_int('min_level_voice_message', 1) THEN
    RAISE EXCEPTION 'FREE_NO_VOICE'
      USING HINT = 'Les messages vocaux ne sont pas inclus dans votre formule.';
  END IF;

  IF NEW.media_type = 'video'
     AND v_level < public.setting_int('min_level_video_message', 4) THEN
    RAISE EXCEPTION 'VIP_ONLY_VIDEO_MESSAGE'
      USING HINT = 'L''envoi de vidéos en conversation n''est pas inclus dans votre formule.';
  END IF;

  v_quota := public.quota_messages(v_level);
  IF v_quota = -1 THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_sent
  FROM public.messages m
  WHERE m.sender_id = NEW.sender_id
    AND m.created_at >= date_trunc('day', timezone('utc'::text, now()));

  IF v_sent >= v_quota THEN
    RAISE EXCEPTION 'MESSAGE_QUOTA_REACHED'
      USING HINT = 'Quota de ' || v_quota || ' messages quotidiens atteint.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_call_limits()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_level smallint;
BEGIN
  v_level := public.effective_level(NEW.caller_id);

  IF v_level < public.setting_int('min_level_audio_call', 1) THEN
    RAISE EXCEPTION 'FREE_NO_CALLS'
      USING HINT = 'Les appels ne sont pas inclus dans votre formule.';
  END IF;

  IF NEW.call_type = 'video'
     AND v_level < public.setting_int('min_level_video_call', 4) THEN
    RAISE EXCEPTION 'VIP_ONLY_VIDEO_CALL'
      USING HINT = 'Les appels vidéo ne sont pas inclus dans votre formule.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_community_media()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_level smallint;
BEGIN
  v_level := public.effective_level(NEW.user_id);

  IF COALESCE(NEW.image_url, '') <> ''
     AND v_level < public.setting_int('min_level_post_image', 1) THEN
    RAISE EXCEPTION 'FREE_NO_MEDIA_POST'
      USING HINT = 'Les publications avec photo ne sont pas incluses dans votre formule.';
  END IF;

  IF COALESCE(NEW.video_url, '') <> ''
     AND v_level < public.setting_int('min_level_post_video', 4) THEN
    RAISE EXCEPTION 'VIP_ONLY_VIDEO_POST'
      USING HINT = 'Les publications vidéo ne sont pas incluses dans votre formule.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 6. Boost : durée selon le palier
-- ------------------------------------------------------------
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

  v_plan  := public.effective_plan(v_user);
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

  v_minutes := public.setting_int('boost_minutes_l' || v_level::text, 30);

  -- Une durée nulle rendrait le Boost inopérant tout en le décomptant du
  -- quota : mieux vaut refuser franchement.
  IF v_minutes <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan', 'plan', v_plan);
  END IF;

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
-- 7. Plafond d'e-mails : la clé posée par la 32 est enfin lue
-- ------------------------------------------------------------
-- `email_daily_cap` s'affichait dans /admin/parametres sans rien piloter :
-- chaque appelant passait sa propre valeur. Le réglage fait désormais
-- autorité, l'argument ne servant que de repli.
CREATE OR REPLACE FUNCTION public.can_send_email(
  p_user_id uuid,
  p_email text,
  p_category text,
  p_dedupe_key text DEFAULT NULL,
  p_max_per_day integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_allowed boolean;
  v_sent    integer;
  v_cap     integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.email_suppression s WHERE s.email = lower(p_email)) THEN
    RETURN jsonb_build_object('send', false, 'reason', 'suppressed');
  END IF;

  IF p_dedupe_key IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.email_log l WHERE l.dedupe_key = p_dedupe_key) THEN
    RETURN jsonb_build_object('send', false, 'reason', 'duplicate');
  END IF;

  IF p_category = 'transactional' THEN
    RETURN jsonb_build_object('send', true);
  END IF;

  EXECUTE format('SELECT %I FROM public.email_preferences WHERE user_id = $1', p_category)
  INTO v_allowed USING p_user_id;

  IF NOT COALESCE(v_allowed, false) THEN
    RETURN jsonb_build_object('send', false, 'reason', 'opted_out');
  END IF;

  v_cap := public.setting_int('email_daily_cap', p_max_per_day);

  SELECT count(*) INTO v_sent
  FROM public.email_log l
  WHERE l.user_id = p_user_id
    AND l.category <> 'transactional'
    AND l.sent_at >= date_trunc('day', timezone('utc'::text, now()));

  IF v_sent >= v_cap THEN
    RETURN jsonb_build_object('send', false, 'reason', 'rate_limited');
  END IF;

  RETURN jsonb_build_object('send', true);
END;
$$;

REVOKE ALL ON FUNCTION public.can_send_email(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_send_email(uuid, text, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.can_send_email(uuid, text, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_email(uuid, text, text, text, integer) TO service_role;

-- ------------------------------------------------------------
-- 8. Droits d'exécution
-- ------------------------------------------------------------
-- Ces fonctions ne prennent qu'un palier en argument, jamais un identifiant
-- de membre : elles ne peuvent donc rien divulguer sur autrui. L'interface
-- s'en sert pour afficher les quotas en vigueur.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['quota_messages','quota_boosts','quota_likes',
                            'quota_superlikes','superlike_cooldown']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(smallint) FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(smallint) FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(smallint) TO authenticated, service_role', fn);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.setting_text(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.setting_text(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 9. Contrôle
-- ------------------------------------------------------------
-- Doit renvoyer une ligne par palier, cohérente avec vos offres.
-- `generate_series` produit des integer : le cast explicite en smallint est
-- indispensable, sans quoi Postgres ne trouve pas la fonction (erreur 42883).
SELECT
  lvl                                              AS palier,
  public.quota_messages(lvl::smallint)             AS messages_jour,
  public.quota_likes(lvl::smallint)                AS likes_jour,
  public.quota_superlikes(lvl::smallint)           AS superlikes_jour,
  public.superlike_cooldown(lvl::smallint)         AS delai_superlike_j,
  public.quota_boosts(lvl::smallint)               AS boosts_mois,
  public.setting_int('boost_minutes_l' || lvl::text, 30) AS boost_minutes
FROM generate_series(0, 4) AS lvl
ORDER BY lvl;
