-- ============================================================
-- Notifications push
-- ============================================================
-- L'application n'en avait aucune. Un membre reçoit un match, ne le sait
-- pas, ne revient pas : c'est la première cause de perte silencieuse sur
-- une application de rencontre.
--
-- Choix du Web Push (norme W3C) plutôt que Firebase : il fonctionne sur
-- Chrome Android — largement dominant sur votre marché — SANS passer par
-- un magasin d'applications, et sans dépendre de Google.
--
-- ⚠️ PRÉREQUIS
--   1. Extension `pg_net` (déclenchement HTTP depuis un trigger)
--   2. Fonction Edge `send-push` déployée
--   3. Les secrets renseignés à la section 2 ci-dessous

-- ------------------------------------------------------------
-- 0. Extension
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 1. Les abonnements des appareils
-- ------------------------------------------------------------
-- Un membre = plusieurs appareils possibles (téléphone, ordinateur).
-- L'`endpoint` est l'identifiant unique fourni par le navigateur.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Mis à jour à chaque envoi réussi. Une valeur ancienne signale un
  -- appareil abandonné, qu'on pourra purger.
  last_used  timestamp with time zone
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chacun voit ses appareils" ON public.push_subscriptions;
CREATE POLICY "Chacun voit ses appareils"
ON public.push_subscriptions FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Chacun enregistre son appareil" ON public.push_subscriptions;
CREATE POLICY "Chacun enregistre son appareil"
ON public.push_subscriptions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Chacun met à jour son appareil" ON public.push_subscriptions;
CREATE POLICY "Chacun met à jour son appareil"
ON public.push_subscriptions FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Chacun retire son appareil" ON public.push_subscriptions;
CREATE POLICY "Chacun retire son appareil"
ON public.push_subscriptions FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. Secrets serveur
-- ------------------------------------------------------------
-- Table SANS aucune politique RLS : RLS activée et zéro policy signifie
-- que personne ne peut lire, pas même un administrateur connecté. Seules
-- les fonctions SECURITY DEFINER y accèdent.
--
-- Les secrets ne peuvent PAS aller dans `app_settings`, qui est lisible
-- sans authentification (c'est voulu pour le mode maintenance).
CREATE TABLE IF NOT EXISTS public.server_secrets (
  key   text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public.server_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_secrets FROM anon, authenticated;

-- ⚠️ REMPLACEZ les deux valeurs ci-dessous avant d'exécuter.
--    `push_endpoint` : l'URL de votre fonction Edge
--    `push_secret`   : une chaîne aléatoire de votre choix, à reporter
--                      dans les secrets de la fonction Edge
INSERT INTO public.server_secrets (key, value) VALUES
  ('push_endpoint', 'https://VOTRE-PROJET.supabase.co/functions/v1/send-push'),
  ('push_secret',   'REMPLACEZ-MOI-PAR-UNE-CHAINE-ALEATOIRE')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Envoi
-- ------------------------------------------------------------
-- Appel HTTP **asynchrone** via pg_net : `net.http_post` dépose la
-- requête dans une file et rend la main immédiatement. Un envoi
-- synchrone ferait attendre l'insertion du message le temps de joindre
-- Google et Mozilla — donc une conversation qui rame à chaque message.
CREATE OR REPLACE FUNCTION public.envoyer_push(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_url     text DEFAULT '/accueil',
  p_tag     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_endpoint text;
  v_secret   text;
BEGIN
  -- Personne à joindre : on sort avant de payer un appel réseau.
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

  PERFORM net.http_post(
    url     := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body    := jsonb_build_object(
      'user_id', p_user_id,
      'title',   p_title,
      'body',    p_body,
      'url',     p_url,
      'tag',     p_tag
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- 4. Nouveau message
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_nouveau_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dest    uuid;
  v_prenom  text;
  v_apercu  text;
  v_recent  boolean;
BEGIN
  SELECT CASE WHEN m.user1_id = NEW.sender_id THEN m.user2_id ELSE m.user1_id END
    INTO v_dest
  FROM public.matches m WHERE m.id = NEW.match_id;

  IF v_dest IS NULL THEN RETURN NEW; END IF;

  -- Anti-rafale : si le destinataire a déjà reçu un message de la même
  -- personne dans la minute, on se tait. Sans cela, une conversation
  -- animée déclencherait une notification par phrase.
  SELECT EXISTS (
    SELECT 1 FROM public.messages m2
    WHERE m2.match_id = NEW.match_id
      AND m2.sender_id = NEW.sender_id
      AND m2.id <> NEW.id
      AND m2.created_at > timezone('utc'::text, now()) - interval '60 seconds'
  ) INTO v_recent;

  IF v_recent THEN RETURN NEW; END IF;

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
    -- Un tag par conversation : les messages successifs se remplacent
    -- au lieu de s'empiler.
    'msg-' || NEW.match_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_message ON public.messages;
CREATE TRIGGER trg_push_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.push_nouveau_message();

-- ------------------------------------------------------------
-- 5. Nouveau match
-- ------------------------------------------------------------
-- L'évènement le plus motivant de l'application : les DEUX sont prévenus.
CREATE OR REPLACE FUNCTION public.push_nouveau_match()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p1 text;
  v_p2 text;
BEGIN
  SELECT first_name INTO v_p1 FROM public.profiles WHERE id = NEW.user1_id;
  SELECT first_name INTO v_p2 FROM public.profiles WHERE id = NEW.user2_id;

  PERFORM public.envoyer_push(
    NEW.user1_id, 'Nouveau match ✨',
    COALESCE(v_p2, 'Quelqu''un') || ' vous a aimé aussi. Lancez la conversation.',
    '/messages', 'match-' || NEW.id::text
  );

  PERFORM public.envoyer_push(
    NEW.user2_id, 'Nouveau match ✨',
    COALESCE(v_p1, 'Quelqu''un') || ' vous a aimé aussi. Lancez la conversation.',
    '/messages', 'match-' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_match ON public.matches;
CREATE TRIGGER trg_push_match
AFTER INSERT ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.push_nouveau_match();

-- ------------------------------------------------------------
-- 6. Super Like reçu
-- ------------------------------------------------------------
-- Seulement le Super Like, PAS le like ordinaire : un membre visible
-- peut en recevoir des dizaines par jour, et autant de notifications
-- feraient désactiver les alertes — donc perdre aussi les matches.
--
-- Le prénom n'est pas révélé : voir QUI a envoyé un Super Like fait
-- partie de l'offre payante.
CREATE OR REPLACE FUNCTION public.push_superlike()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.action <> 'superlike' THEN RETURN NEW; END IF;

  PERFORM public.envoyer_push(
    NEW.target_id,
    'Vous avez reçu un Super Like ⭐',
    'Quelqu''un vous remarque vraiment.',
    '/demandes', 'superlike'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_superlike ON public.swipes;
CREATE TRIGGER trg_push_superlike
AFTER INSERT ON public.swipes
FOR EACH ROW EXECUTE FUNCTION public.push_superlike();

-- ------------------------------------------------------------
-- 7. Appel entrant
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_appel()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prenom text;
BEGIN
  IF NEW.status <> 'ringing' THEN RETURN NEW; END IF;

  SELECT first_name INTO v_prenom FROM public.profiles WHERE id = NEW.caller_id;

  PERFORM public.envoyer_push(
    NEW.callee_id,
    COALESCE(v_prenom, 'Quelqu''un') || ' vous appelle',
    CASE WHEN NEW.call_type = 'video' THEN 'Appel vidéo' ELSE 'Appel audio' END,
    '/messages', 'call'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_appel ON public.calls;
CREATE TRIGGER trg_push_appel
AFTER INSERT ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.push_appel();

-- ------------------------------------------------------------
-- 8. Purge des appareils morts
-- ------------------------------------------------------------
-- Appelée par la fonction Edge quand un service de push répond 404 ou
-- 410 : l'abonnement a été révoqué (application désinstallée, données du
-- navigateur effacées). Le garder ferait échouer un envoi sur deux.
CREATE OR REPLACE FUNCTION public.purger_push(p_endpoint text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
$$;

GRANT EXECUTE ON FUNCTION public.purger_push(text) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_net')       AS pg_net_installe,
  (SELECT count(*) FROM public.server_secrets
    WHERE key = 'push_endpoint' AND value NOT LIKE '%VOTRE-PROJET%') AS endpoint_configure,
  (SELECT count(*) FROM public.server_secrets
    WHERE key = 'push_secret' AND value NOT LIKE 'REMPLACEZ%')       AS secret_configure,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN
    ('trg_push_message','trg_push_match','trg_push_superlike','trg_push_appel'))
                                                                     AS triggers_poses;
