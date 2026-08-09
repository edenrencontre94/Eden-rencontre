-- ============================================================
-- Messages en rafale : remplacer au lieu de supprimer
-- ============================================================
-- CE QUI N'ALLAIT PAS
--
-- La migration 58 supprimait purement la notification lorsqu'un second
-- message de la même personne arrivait dans la minute. L'intention était
-- juste — une conversation animée ne doit pas sonner à chaque phrase.
--
-- Mais depuis la migration 60, la pastille de l'icône voyage AVEC la
-- notification. Supprimer l'une supprime donc l'autre : cinq messages en
-- trente secondes laissaient la pastille bloquée sur « 1 », et le membre
-- en découvrait cinq en ouvrant.
--
-- LA CORRECTION
--
-- On envoie toujours, mais en signalant `silencieux`. Le service worker
-- réutilise alors le même `tag` avec `renotify: false` : la notification
-- existante est REMPLACÉE — texte à jour, pastille à jour — sans nouvelle
-- sonnerie ni vibration.
--
-- Un seul son, un seul élément à l'écran, mais le chiffre juste. C'est le
-- comportement de WhatsApp.
--
-- AJOUT PUR : deux `CREATE OR REPLACE FUNCTION`. Aucun trigger n'est
-- recréé, aucune table touchée.

-- ------------------------------------------------------------
-- 1. Le drapeau « silencieux » traverse l'envoi
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.envoyer_push(
  p_user_id    uuid,
  p_title      text,
  p_body       text,
  p_url        text DEFAULT '/accueil',
  p_tag        text DEFAULT NULL,
  p_silencieux boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_endpoint text;
  v_secret   text;
  v_badge    integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = p_user_id
  ) THEN
    RETURN;
  END IF;

  SELECT value INTO v_endpoint FROM public.server_secrets WHERE key = 'push_endpoint';
  SELECT value INTO v_secret   FROM public.server_secrets WHERE key = 'push_secret';

  IF v_endpoint IS NULL OR v_secret IS NULL THEN
    RETURN;
  END IF;

  v_badge := public.badge_total(p_user_id);

  PERFORM net.http_post(
    url     := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body    := jsonb_build_object(
      'user_id',    p_user_id,
      'title',      p_title,
      'body',       p_body,
      'url',        p_url,
      'tag',        p_tag,
      'badge',      v_badge,
      'silencieux', p_silencieux
    )
  );
END;
$$;

-- L'ancienne signature à cinq arguments doit disparaître : PostgreSQL
-- garderait les deux en surcharge, et un appel à cinq paramètres
-- continuerait d'atteindre la version sans `silencieux`.
DROP FUNCTION IF EXISTS public.envoyer_push(uuid, text, text, text, text);

-- ------------------------------------------------------------
-- 2. Le message en rafale n'est plus supprimé
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_nouveau_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dest    uuid;
  v_prenom  text;
  v_apercu  text;
  v_rafale  boolean;
BEGIN
  SELECT CASE WHEN m.user1_id = NEW.sender_id THEN m.user2_id ELSE m.user1_id END
    INTO v_dest
  FROM public.matches m WHERE m.id = NEW.match_id;

  IF v_dest IS NULL THEN RETURN NEW; END IF;

  -- Un message de la même personne dans la minute : on remplace la
  -- notification existante au lieu d'en empiler une nouvelle.
  SELECT EXISTS (
    SELECT 1 FROM public.messages m2
    WHERE m2.match_id = NEW.match_id
      AND m2.sender_id = NEW.sender_id
      AND m2.id <> NEW.id
      AND m2.created_at > timezone('utc'::text, now()) - interval '60 seconds'
  ) INTO v_rafale;

  SELECT first_name INTO v_prenom FROM public.profiles WHERE id = NEW.sender_id;

  -- Aperçu tronqué, et JAMAIS le contenu d'un média : une photo reçue ne
  -- doit pas voir sa légende s'afficher sur un écran verrouillé.
  v_apercu := CASE
    WHEN NEW.media_type IS NOT NULL THEN
      CASE NEW.media_type
        WHEN 'image'   THEN 'Photo'
        WHEN 'video'   THEN 'Vidéo'
        WHEN 'audio'   THEN 'Message vocal'
        WHEN 'gif'     THEN 'Sticker animé'
        WHEN 'sticker' THEN 'Sticker'
        ELSE 'Pièce jointe'
      END
    WHEN length(COALESCE(NEW.content, '')) > 80 THEN left(NEW.content, 77) || '…'
    ELSE COALESCE(NEW.content, '')
  END;

  PERFORM public.envoyer_push(
    v_dest,
    COALESCE(v_prenom, 'Nouveau message'),
    v_apercu,
    '/messages',
    -- Même tag pour toute la conversation : c'est lui qui permet le
    -- remplacement plutôt que l'empilement.
    'msg-' || NEW.match_id::text,
    v_rafale
  );

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Contrôle : une seule version d'`envoyer_push` doit subsister, à six
-- arguments.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'envoyer_push';
