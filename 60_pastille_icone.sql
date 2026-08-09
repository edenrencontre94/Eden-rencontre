-- ============================================================
-- Pastille chiffrée sur l'icône de l'application
-- ============================================================
-- Le petit rond rouge que WhatsApp affiche sur son icône, sans qu'on
-- ait besoin d'ouvrir quoi que ce soit.
--
-- Le service worker ne peut PAS calculer ce nombre : il n'a ni session
-- ni accès à la base. Le total est donc joint à chaque notification
-- envoyée, et le navigateur pose la pastille même application fermée.
--
-- AJOUT PUR : cette migration remplace trois fonctions de la 58 par
-- `CREATE OR REPLACE`. Aucune table, aucun déclencheur, aucune donnée
-- n'est touché — les triggers existants continuent d'appeler les mêmes
-- noms de fonctions.

-- ------------------------------------------------------------
-- 1. Le nombre à afficher
-- ------------------------------------------------------------
-- Messages non lus + demandes en attente. PAS les publications de la
-- communauté : une pastille rouge doit signaler ce qui s'adresse
-- personnellement au membre. Y compter le fil la ferait clignoter en
-- permanence, et on cesserait de la regarder.
--
-- Variante de `my_badges()` prenant l'identifiant en paramètre : celle-ci
-- s'appuie sur `auth.uid()`, absent dans un trigger.
CREATE OR REPLACE FUNCTION public.badge_total(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_messages integer := 0;
  v_demandes integer := 0;
  v_archive  boolean;
BEGIN
  IF p_user_id IS NULL THEN RETURN 0; END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'archived_chats'
  ) INTO v_archive;

  SELECT count(*) INTO v_messages
  FROM public.messages m
  JOIN public.matches ma ON ma.id = m.match_id
  WHERE m.sender_id <> p_user_id
    AND m.read_at IS NULL
    AND (ma.user1_id = p_user_id OR ma.user2_id = p_user_id)
    AND (
      NOT v_archive
      OR NOT EXISTS (
        SELECT 1 FROM public.archived_chats a
        WHERE a.user_id = p_user_id AND a.match_id = m.match_id
      )
    );

  SELECT count(*) INTO v_demandes
  FROM public.swipes s
  WHERE s.target_id = p_user_id
    AND s.action IN ('like', 'superlike')
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes r
      WHERE r.swiper_id = p_user_id AND r.target_id = s.swiper_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = s.swiper_id)
         OR (b.blocker_id = s.swiper_id AND b.blocked_id = p_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.dismissed_likes d
      WHERE d.user_id = p_user_id AND d.dismissed_user_id = s.swiper_id
    );

  RETURN v_messages + v_demandes;
END;
$$;

-- ------------------------------------------------------------
-- 2. Le total voyage avec la notification
-- ------------------------------------------------------------
-- Même signature qu'en migration 58, aux paramètres près : les triggers
-- existants continuent de fonctionner sans être recréés.
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

  -- Calculé ICI, dans le trigger AFTER INSERT : le message qui déclenche
  -- la notification est donc déjà compté. Le chiffre affiché correspond
  -- à ce que le membre trouvera en ouvrant.
  v_badge := public.badge_total(p_user_id);

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
      'tag',     p_tag,
      'badge',   v_badge
    )
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Contrôle : remplacez l'identifiant par le vôtre.
-- SELECT public.badge_total('00000000-0000-0000-0000-000000000000');
SELECT 'migration 60 appliquee' AS resultat;
