-- ============================================================
-- Socle e-mail : préférences, journal, suppression, désabonnement
-- ============================================================
-- À exécuter AVANT tout envoi de masse.
--
-- Pourquoi ce socle est un préalable et non un raffinement :
-- une application de rencontre peut produire dix e-mails par jour et par
-- membre (match, message, visite, Super Like). Au-delà de 0,3 % de plaintes,
-- Gmail déclasse le domaine — et comme les e-mails d'authentification
-- partent du MÊME domaine, les confirmations d'inscription cessent
-- d'arriver. Le plafonnement protège donc l'inscription elle-même.

-- ------------------------------------------------------------
-- 1. Préférences — remplacent le localStorage
-- ------------------------------------------------------------
-- Les préférences vivaient dans le navigateur (clé « agape_notif_prefs ») :
-- le serveur ne pouvait pas les lire, donc tout envoi les aurait ignorées.
CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Non désactivable : paiements, sécurité, changements de compte.
  -- Présent pour mémoire, jamais consulté avant un envoi transactionnel.
  transactional boolean NOT NULL DEFAULT true,
  matches boolean NOT NULL DEFAULT true,
  messages boolean NOT NULL DEFAULT true,
  visitors boolean NOT NULL DEFAULT true,
  community boolean NOT NULL DEFAULT true,
  -- Marketing : consentement EXPLICITE, donc faux par défaut.
  marketing boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their email preferences" ON public.email_preferences;
CREATE POLICY "Users read their email preferences"
ON public.email_preferences FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users set their email preferences" ON public.email_preferences;
CREATE POLICY "Users set their email preferences"
ON public.email_preferences FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their email preferences" ON public.email_preferences;
CREATE POLICY "Users update their email preferences"
ON public.email_preferences FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Une ligne pour chaque membre existant
INSERT INTO public.email_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Jeton de désabonnement
-- ------------------------------------------------------------
-- Gmail impose un désabonnement en UN CLIC, donc sans connexion préalable.
-- Un jeton aléatoire par membre permet d'identifier le destinataire sans
-- exposer son identifiant ni exiger une session.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS unsubscribe_token uuid DEFAULT gen_random_uuid();

UPDATE public.profiles SET unsubscribe_token = gen_random_uuid()
WHERE unsubscribe_token IS NULL;

ALTER TABLE public.profiles ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_unsub_token_uidx
ON public.profiles (unsubscribe_token);

-- ------------------------------------------------------------
-- 3. Journal des envois
-- ------------------------------------------------------------
-- Trois usages : ne pas envoyer deux fois le même message, plafonner la
-- fréquence, et disposer d'une trace en cas de contestation.
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  category text NOT NULL,
  template text NOT NULL,
  -- Clé d'unicité fonctionnelle : « match:<id> », « expiring:<user>:<date> »…
  dedupe_key text UNIQUE,
  resend_id text,
  sent_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS email_log_user_sent_idx
ON public.email_log (user_id, sent_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
-- Aucune policy : réservé aux Edge Functions (service key).

-- ------------------------------------------------------------
-- 4. Liste de suppression
-- ------------------------------------------------------------
-- Continuer d'écrire à une adresse en rebond dur, ou à quelqu'un ayant
-- signalé un courrier indésirable, dégrade la réputation du domaine à
-- chaque tentative. Ces adresses sont donc définitivement écartées.
CREATE TABLE IF NOT EXISTS public.email_suppression (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('bounce', 'complaint', 'manual')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.email_suppression ENABLE ROW LEVEL SECURITY;
-- Aucune policy : réservé aux Edge Functions.

-- ------------------------------------------------------------
-- 5. Décision d'envoi, calculée en base
-- ------------------------------------------------------------
-- Regrouper la règle ici plutôt que dans le code évite qu'une Edge Function
-- oublie une vérification. `transactional` ignore volontairement préférences
-- et plafond : un reçu de paiement doit toujours partir.
CREATE OR REPLACE FUNCTION public.can_send_email(
  p_user_id uuid,
  p_email text,
  p_category text,
  p_dedupe_key text DEFAULT NULL,
  p_max_per_day integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
  v_sent    integer;
BEGIN
  -- Suppression : bloquante pour TOUT, y compris le transactionnel.
  -- Insister sur une adresse morte ne sert personne.
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

  SELECT count(*) INTO v_sent
  FROM public.email_log l
  WHERE l.user_id = p_user_id
    AND l.category <> 'transactional'
    AND l.sent_at >= timezone('utc'::text, now()) - interval '24 hours';

  IF v_sent >= p_max_per_day THEN
    RETURN jsonb_build_object('send', false, 'reason', 'rate_limited', 'sent_24h', v_sent);
  END IF;

  RETURN jsonb_build_object('send', true);
END;
$$;

REVOKE ALL ON FUNCTION public.can_send_email(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_send_email(uuid, text, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.can_send_email(uuid, text, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_email(uuid, text, text, text, integer) TO service_role;

-- ------------------------------------------------------------
-- 6. Désabonnement par jeton
-- ------------------------------------------------------------
-- Appelée par une fonction publique, sans session : c'est la raison d'être
-- du jeton. Elle ne peut désactiver qu'une catégorie facultative.
CREATE OR REPLACE FUNCTION public.unsubscribe_by_token(
  p_token uuid,
  p_category text DEFAULT 'marketing'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF p_category NOT IN ('matches', 'messages', 'visitors', 'community', 'marketing', 'all') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_category');
  END IF;

  SELECT id INTO v_user FROM public.profiles WHERE unsubscribe_token = p_token;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_token');
  END IF;

  INSERT INTO public.email_preferences (user_id) VALUES (v_user)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_category = 'all' THEN
    UPDATE public.email_preferences
    SET matches = false, messages = false, visitors = false,
        community = false, marketing = false,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = v_user;
  ELSE
    EXECUTE format(
      'UPDATE public.email_preferences SET %I = false, updated_at = now() WHERE user_id = $1',
      p_category
    ) USING v_user;
  END IF;

  RETURN jsonb_build_object('ok', true, 'category', p_category);
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_by_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unsubscribe_by_token(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.unsubscribe_by_token(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_by_token(uuid, text) TO service_role;

-- ------------------------------------------------------------
-- 7. Chaque nouveau membre reçoit préférences et jeton
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.init_email_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.email_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_email_preferences ON public.profiles;
CREATE TRIGGER trg_init_email_preferences
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.init_email_preferences();

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 8. Contrôle
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.email_preferences) AS preferences_creees,
  (SELECT count(*) FROM public.profiles WHERE unsubscribe_token IS NOT NULL) AS jetons_poses,
  (SELECT count(*) FROM public.profiles) AS total_profils;
