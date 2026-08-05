-- ============================================================
-- Migration : limites de la formule Gratuit
-- ============================================================
-- Ces règles sont imposées EN BASE, pas seulement dans l'interface : une
-- restriction uniquement affichée se contourne depuis la console du
-- navigateur en appelant l'API directement.
--
-- Choix de l'outil : des TRIGGERS plutôt que des policies RLS. Les tables
-- concernées portent déjà des policies écrites ailleurs, qu'un DROP/CREATE
-- risquerait d'écraser — et casser l'envoi de messages pour tout le monde.
-- Un trigger s'ajoute sans toucher à l'existant.
--
-- Les membres fondateurs sont traités comme VIP (voir effective_plan).

-- ------------------------------------------------------------
-- 1. Messages : 5 par jour, aucun vocal
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_message_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_sent integer;
BEGIN
  v_plan := public.effective_plan(NEW.sender_id);
  IF v_plan <> 'gratuit' THEN RETURN NEW; END IF;

  IF NEW.media_type = 'audio' THEN
    RAISE EXCEPTION 'FREE_NO_VOICE'
      USING HINT = 'Les messages vocaux sont réservés aux membres Premium et VIP.';
  END IF;

  SELECT count(*) INTO v_sent
  FROM public.messages m
  WHERE m.sender_id = NEW.sender_id
    AND m.created_at >= date_trunc('day', timezone('utc'::text, now()));

  IF v_sent >= 5 THEN
    RAISE EXCEPTION 'FREE_MESSAGE_QUOTA'
      USING HINT = 'Vous avez atteint vos 5 messages quotidiens.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_limits ON public.messages;
CREATE TRIGGER trg_message_limits
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_limits();

-- ------------------------------------------------------------
-- 2. Swipes : 25 likes par jour, 1 Super Like tous les 7 jours
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_swipe_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_count integer;
  v_last  timestamp with time zone;
BEGIN
  v_plan := public.effective_plan(NEW.swiper_id);
  IF v_plan <> 'gratuit' THEN RETURN NEW; END IF;

  IF NEW.action = 'superlike' THEN
    SELECT max(s.created_at) INTO v_last
    FROM public.swipes s
    WHERE s.swiper_id = NEW.swiper_id AND s.action = 'superlike';

    IF v_last IS NOT NULL AND v_last > timezone('utc'::text, now()) - interval '7 days' THEN
      RAISE EXCEPTION 'FREE_SUPERLIKE_COOLDOWN'
        USING HINT = 'Un Super Like tous les 7 jours en formule Gratuit.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.action = 'like' THEN
    SELECT count(*) INTO v_count
    FROM public.swipes s
    WHERE s.swiper_id = NEW.swiper_id
      AND s.action = 'like'
      AND s.created_at >= date_trunc('day', timezone('utc'::text, now()));

    IF v_count >= 25 THEN
      RAISE EXCEPTION 'FREE_LIKE_QUOTA'
        USING HINT = 'Vous avez atteint vos 25 likes quotidiens.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_swipe_limits ON public.swipes;
CREATE TRIGGER trg_swipe_limits
BEFORE INSERT ON public.swipes
FOR EACH ROW EXECUTE FUNCTION public.enforce_swipe_limits();

-- ------------------------------------------------------------
-- 3. Appels audio et vidéo : réservés aux formules payantes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_call_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.effective_plan(NEW.caller_id) = 'gratuit' THEN
    RAISE EXCEPTION 'FREE_NO_CALLS'
      USING HINT = 'Les appels audio et vidéo sont réservés aux membres Premium et VIP.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_call_limits ON public.calls;
CREATE TRIGGER trg_call_limits
BEFORE INSERT ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.enforce_call_limits();

-- ------------------------------------------------------------
-- 4. Communauté : texte seul en formule Gratuit
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_community_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.effective_plan(NEW.user_id) <> 'gratuit' THEN RETURN NEW; END IF;

  IF COALESCE(NEW.image_url, '') <> '' OR COALESCE(NEW.video_url, '') <> '' THEN
    RAISE EXCEPTION 'FREE_NO_MEDIA_POST'
      USING HINT = 'Les publications avec photo ou vidéo sont réservées aux membres Premium et VIP.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_media ON public.community_posts;
CREATE TRIGGER trg_community_media
BEFORE INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_community_media();

-- ------------------------------------------------------------
-- 5. Visibilité du profil : réglage réservé aux formules payantes
-- ------------------------------------------------------------
-- On ne bloque pas la mise à jour du profil (ce serait invivable) :
-- on force simplement la visibilité à rester « tous » pour un gratuit.
CREATE OR REPLACE FUNCTION public.enforce_visibility_control()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.visibility IS DISTINCT FROM OLD.visibility
     AND public.effective_plan(NEW.id) = 'gratuit' THEN
    NEW.visibility := 'tous';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visibility_control ON public.profiles;
CREATE TRIGGER trg_visibility_control
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_visibility_control();

-- Remettre à « tous » les gratuits qui auraient déjà changé leur visibilité
UPDATE public.profiles p
SET visibility = 'tous'
WHERE p.visibility <> 'tous'
  AND NOT p.is_founder
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p.id AND s.expires_at > timezone('utc'::text, now())
  );

-- ------------------------------------------------------------
-- 6. Compteurs lus par l'application
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_quotas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_now      timestamp with time zone := timezone('utc'::text, now());
  v_plan     text;
  v_messages integer;
  v_likes    integer;
  v_last_sl  timestamp with time zone;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('plan', 'gratuit'); END IF;

  v_plan := public.effective_plan(v_user);

  IF v_plan <> 'gratuit' THEN
    RETURN jsonb_build_object(
      'plan', v_plan,
      'messages_left', -1,
      'likes_left', -1,
      'superlike_available_at', NULL
    );
  END IF;

  SELECT count(*) INTO v_messages
  FROM public.messages m
  WHERE m.sender_id = v_user AND m.created_at >= date_trunc('day', v_now);

  SELECT count(*) INTO v_likes
  FROM public.swipes s
  WHERE s.swiper_id = v_user AND s.action = 'like' AND s.created_at >= date_trunc('day', v_now);

  SELECT max(s.created_at) INTO v_last_sl
  FROM public.swipes s
  WHERE s.swiper_id = v_user AND s.action = 'superlike';

  RETURN jsonb_build_object(
    'plan', 'gratuit',
    'messages_left', GREATEST(0, 5 - v_messages),
    'likes_left', GREATEST(0, 25 - v_likes),
    'superlike_available_at',
      CASE WHEN v_last_sl IS NULL OR v_last_sl <= v_now - interval '7 days'
           THEN NULL ELSE v_last_sl + interval '7 days' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_quotas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_quotas() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_quotas() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 7. Contrôle
-- ------------------------------------------------------------
SELECT tgname AS trigger_pose, tgrelid::regclass AS sur_la_table
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN ('trg_message_limits','trg_swipe_limits','trg_call_limits',
                 'trg_community_media','trg_visibility_control')
ORDER BY 2;
