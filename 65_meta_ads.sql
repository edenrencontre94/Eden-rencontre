-- ============================================================
-- Meta Ads — attribution, événements de conversion, diagnostic
-- ============================================================
-- CE QUE CETTE MIGRATION PERMET
--
-- Relier une campagne Meta à ce qu'elle produit réellement dans
-- l'application : une inscription, un profil complété, un match, un
-- abonnement, un revenu.
--
-- CE QU'ELLE NE PERMET PAS, ET POURQUOI
--
-- Les dépenses publicitaires, impressions, clics, CTR et CPC
-- n'existent que dans l'API Marketing de Meta, qui exige une
-- autorisation OAuth sur un compte publicitaire. Tant que cette
-- connexion n'est pas établie, ces chiffres ne sont PAS calculables —
-- et donc ni le ROAS ni le coût par abonné.
--
-- L'interface affichera « Connexion Meta requise » à ces endroits.
-- Inventer un nombre serait pire que de ne rien afficher : on prendrait
-- des décisions de budget sur une donnée fausse.
--
-- AJOUT PUR : deux tables, six colonnes, trois fonctions. Rien n'est
-- modifié ni supprimé.

-- ------------------------------------------------------------
-- 1. Provenance d'un membre
-- ------------------------------------------------------------
-- Colonnes séparées plutôt qu'un JSON : ce sont elles qu'on regroupe
-- pour l'attribution. Un `GROUP BY donnees->>'campaign'` empêcherait
-- tout index et ralentirait chaque rapport.
--
-- Ces valeurs viennent de l'URL de destination des publicités. Elles
-- sont écrites UNE fois, à la première visite, et jamais réécrites :
-- c'est la campagne qui a amené la personne qui compte, pas la
-- dernière page vue avant l'inscription.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content  text,
  ADD COLUMN IF NOT EXISTS utm_term     text,
  -- Identifiant de clic Facebook. Meta s'en sert pour rattacher une
  -- conversion serveur à l'impression exacte : sans lui, l'attribution
  -- repose sur des signaux beaucoup plus faibles.
  ADD COLUMN IF NOT EXISTS fbclid       text;

CREATE INDEX IF NOT EXISTS profiles_utm_campaign_idx
  ON public.profiles (utm_campaign) WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_utm_source_idx
  ON public.profiles (utm_source) WHERE utm_source IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Visites attribuées
-- ------------------------------------------------------------
-- Une visite précède l'inscription : sans cette table, le haut de
-- l'entonnoir serait vide et l'on ne saurait jamais combien de clics
-- se transforment en comptes.
--
-- Aucune donnée personnelle : ni adresse IP, ni identifiant de suivi
-- durable. Un jeton de session aléatoire suffit à ne pas compter dix
-- fois la même personne.
CREATE TABLE IF NOT EXISTS public.ad_visits (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_key text NOT NULL,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  fbclid       text,
  landing_path text,
  created_at  timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (session_key)
);

CREATE INDEX IF NOT EXISTS ad_visits_date_idx ON public.ad_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS ad_visits_campaign_idx ON public.ad_visits (utm_campaign);

ALTER TABLE public.ad_visits ENABLE ROW LEVEL SECURITY;

-- Une visite s'enregistre AVANT toute connexion : l'insertion doit donc
-- être ouverte. La lecture, elle, reste fermée à tous — seules les
-- fonctions SECURITY DEFINER de cette migration y accèdent.
DROP POLICY IF EXISTS "Enregistrer une visite" ON public.ad_visits;
CREATE POLICY "Enregistrer une visite"
ON public.ad_visits FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- ------------------------------------------------------------
-- 3. Journal des événements envoyés à Meta
-- ------------------------------------------------------------
-- Sert à trois choses : mesurer la santé du tracking, diagnostiquer une
-- panne, et garantir qu'un même événement ne part pas deux fois.
--
-- AUCUN jeton d'accès n'est stocké ici, ni aucune donnée de conversation,
-- de vérification d'identité ou de contenu privé.
CREATE TABLE IF NOT EXISTS public.meta_conversion_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name  text NOT NULL,
  -- Partagé avec l'événement navigateur : c'est lui qui permet à Meta de
  -- reconnaître un doublon plutôt que de compter deux conversions.
  event_id    text NOT NULL,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source      text NOT NULL DEFAULT 'server'
    CHECK (source IN ('server', 'browser', 'test')),
  status      text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  http_status integer,
  error_code  text,
  error_message text,
  meta_reference text,
  value_xof   integer,
  created_at  timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  sent_at     timestamp with time zone,
  -- Un même événement ne peut être journalisé qu'une fois par source :
  -- c'est le garde-fou d'idempotence côté serveur.
  UNIQUE (event_id, source)
);

CREATE INDEX IF NOT EXISTS meta_events_date_idx
  ON public.meta_conversion_events (created_at DESC);
CREATE INDEX IF NOT EXISTS meta_events_name_idx
  ON public.meta_conversion_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS meta_events_status_idx
  ON public.meta_conversion_events (status) WHERE status <> 'sent';

ALTER TABLE public.meta_conversion_events ENABLE ROW LEVEL SECURITY;
-- Aucune politique : seules les fonctions SECURITY DEFINER et le rôle
-- de service y accèdent. Ce journal ne regarde pas les membres.

-- ------------------------------------------------------------
-- 4. Enregistrer une visite publicitaire
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enregistrer_visite_pub(
  p_session      text,
  p_utm_source   text DEFAULT NULL,
  p_utm_medium   text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content  text DEFAULT NULL,
  p_utm_term     text DEFAULT NULL,
  p_fbclid       text DEFAULT NULL,
  p_path         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Une visite sans provenance publicitaire n'a aucun intérêt ici : elle
  -- gonflerait la table sans jamais servir à une attribution.
  IF p_utm_source IS NULL AND p_fbclid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.ad_visits (
    session_key, utm_source, utm_medium, utm_campaign,
    utm_content, utm_term, fbclid, landing_path
  ) VALUES (
    left(p_session, 64), left(p_utm_source, 120), left(p_utm_medium, 120),
    left(p_utm_campaign, 200), left(p_utm_content, 200), left(p_utm_term, 200),
    left(p_fbclid, 400), left(p_path, 300)
  )
  -- Rechargement de page : on garde la PREMIÈRE visite, celle qui porte
  -- la campagne d'origine.
  ON CONFLICT (session_key) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enregistrer_visite_pub(
  text, text, text, text, text, text, text, text
) TO anon, authenticated;

-- ------------------------------------------------------------
-- 5. Rattacher la provenance au profil
-- ------------------------------------------------------------
-- Appelée à la création du profil. N'écrase jamais une valeur déjà
-- posée : la première campagne reste la campagne d'acquisition.
CREATE OR REPLACE FUNCTION public.rattacher_provenance(
  p_utm_source   text DEFAULT NULL,
  p_utm_medium   text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content  text DEFAULT NULL,
  p_utm_term     text DEFAULT NULL,
  p_fbclid       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  UPDATE public.profiles SET
    utm_source   = COALESCE(utm_source,   left(p_utm_source, 120)),
    utm_medium   = COALESCE(utm_medium,   left(p_utm_medium, 120)),
    utm_campaign = COALESCE(utm_campaign, left(p_utm_campaign, 200)),
    utm_content  = COALESCE(utm_content,  left(p_utm_content, 200)),
    utm_term     = COALESCE(utm_term,     left(p_utm_term, 200)),
    fbclid       = COALESCE(fbclid,       left(p_fbclid, 400))
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.rattacher_provenance(
  text, text, text, text, text, text
) TO authenticated;

-- ------------------------------------------------------------
-- 6. Journaliser un événement
-- ------------------------------------------------------------
-- Appelée par la fonction Edge, jamais par le navigateur.
CREATE OR REPLACE FUNCTION public.journaliser_meta_event(
  p_event_name  text,
  p_event_id    text,
  p_user_id     uuid DEFAULT NULL,
  p_source      text DEFAULT 'server',
  p_status      text DEFAULT 'sent',
  p_http_status integer DEFAULT NULL,
  p_error_code  text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_meta_reference text DEFAULT NULL,
  p_value_xof   integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.meta_conversion_events (
    event_name, event_id, user_id, source, status,
    http_status, error_code, error_message, meta_reference, value_xof,
    sent_at
  ) VALUES (
    p_event_name, p_event_id, p_user_id, p_source, p_status,
    p_http_status, p_error_code, left(p_error_message, 500), p_meta_reference,
    p_value_xof,
    CASE WHEN p_status = 'sent' THEN timezone('utc'::text, now()) END
  )
  ON CONFLICT (event_id, source) DO NOTHING;

  -- Faux signifie « déjà journalisé » : l'appelant sait alors qu'il
  -- s'agit d'un rejeu et peut s'abstenir de renvoyer à Meta.
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.journaliser_meta_event(
  text, text, uuid, text, text, integer, text, text, text, integer
) TO service_role;

-- ------------------------------------------------------------
-- 7. Le tableau de bord
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_meta_ads(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deb   timestamp with time zone;
  v_visites integer;
  v_inscrits integer;
BEGIN
  IF NOT public.can('reglages') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_deb := now() - make_interval(days => GREATEST(1, p_days));

  SELECT count(*) INTO v_visites
  FROM public.ad_visits WHERE created_at >= v_deb;

  SELECT count(*) INTO v_inscrits
  FROM public.profiles
  WHERE created_at >= v_deb AND utm_source IS NOT NULL;

  RETURN jsonb_build_object(
    'periode_jours', p_days,

    -- ── Entonnoir, uniquement les membres venus d'une campagne ──
    'entonnoir', jsonb_build_object(
      'visites',   v_visites,
      'inscrits',  v_inscrits,
      'profils',   (SELECT count(*) FROM public.profiles p
                      WHERE p.created_at >= v_deb AND p.utm_source IS NOT NULL
                        AND public.profile_completion(p.id) >= 60),
      'matchs',    (SELECT count(DISTINCT p.id) FROM public.profiles p
                      WHERE p.created_at >= v_deb AND p.utm_source IS NOT NULL
                        AND EXISTS (SELECT 1 FROM public.matches m
                                    WHERE m.user1_id = p.id OR m.user2_id = p.id)),
      -- Un checkout est une ligne de paiement créée, quel qu'en soit le
      -- sort. C'est l'intention d'achat.
      'checkouts', (SELECT count(DISTINCT pay.user_id) FROM public.payments pay
                      JOIN public.profiles p ON p.id = pay.user_id
                      WHERE p.utm_source IS NOT NULL AND pay.created_at >= v_deb),
      'abonnes',   (SELECT count(DISTINCT pay.user_id) FROM public.payments pay
                      JOIN public.profiles p ON p.id = pay.user_id
                      WHERE p.utm_source IS NOT NULL AND pay.status = 'completed'
                        AND pay.completed_at >= v_deb),
      'revenus',   (SELECT COALESCE(sum(pay.amount_xof), 0) FROM public.payments pay
                      JOIN public.profiles p ON p.id = pay.user_id
                      WHERE p.utm_source IS NOT NULL AND pay.status = 'completed'
                        AND pay.completed_at >= v_deb)
    ),

    -- ── Attribution par campagne ──
    -- Les indicateurs par membre sont calculés dans une sous-requête, PUIS
    -- agrégés par campagne. Les calculer directement dans le GROUP BY
    -- obligerait à y inclure `p.id` — et produirait une ligne par membre
    -- au lieu d'une par campagne.
    'campagnes', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'revenus')::bigint DESC, x->>'campagne')
      FROM (
        SELECT jsonb_build_object(
          'campagne', q.camp,
          'source',   q.src,
          'inscrits', count(*)::integer,
          'profils',  count(*) FILTER (WHERE q.completion >= 60)::integer,
          'matchs',   count(*) FILTER (WHERE q.a_match)::integer,
          'abonnes',  count(*) FILTER (WHERE q.a_paye)::integer,
          'revenus',  COALESCE(sum(q.revenu), 0)
        ) AS x
        FROM (
          SELECT
            COALESCE(p.utm_campaign, '(sans nom)') AS camp,
            COALESCE(p.utm_source, '—')            AS src,
            public.profile_completion(p.id)        AS completion,
            EXISTS (SELECT 1 FROM public.matches m
                    WHERE m.user1_id = p.id OR m.user2_id = p.id) AS a_match,
            EXISTS (SELECT 1 FROM public.payments pay
                    WHERE pay.user_id = p.id AND pay.status = 'completed') AS a_paye,
            COALESCE((SELECT sum(pay.amount_xof) FROM public.payments pay
                      WHERE pay.user_id = p.id AND pay.status = 'completed'), 0) AS revenu
          FROM public.profiles p
          WHERE p.utm_source IS NOT NULL AND p.created_at >= v_deb
        ) q
        GROUP BY q.camp, q.src
      ) t
    ), '[]'::jsonb),

    -- ── Santé du tracking ──
    'evenements', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'nom')
      FROM (
        SELECT jsonb_build_object(
          'nom',      e.event_name,
          'total',    count(*)::integer,
          'jour',     count(*) FILTER (WHERE e.created_at >= now() - interval '24 hours')::integer,
          'reussis',  count(*) FILTER (WHERE e.status = 'sent')::integer,
          'echecs',   count(*) FILTER (WHERE e.status = 'failed')::integer,
          'sources',  (SELECT jsonb_agg(DISTINCT e2.source) FROM public.meta_conversion_events e2
                         WHERE e2.event_name = e.event_name),
          'dernier',  max(e.created_at)
        ) AS x
        FROM public.meta_conversion_events e
        WHERE e.created_at >= v_deb
        GROUP BY e.event_name
      ) t
    ), '[]'::jsonb),

    'sante', jsonb_build_object(
      'envoyes_24h', (SELECT count(*) FROM public.meta_conversion_events
                        WHERE created_at >= now() - interval '24 hours'),
      'reussis_24h', (SELECT count(*) FROM public.meta_conversion_events
                        WHERE created_at >= now() - interval '24 hours' AND status = 'sent'),
      'echecs_24h',  (SELECT count(*) FROM public.meta_conversion_events
                        WHERE created_at >= now() - interval '24 hours' AND status = 'failed'),
      'dernier',     (SELECT max(created_at) FROM public.meta_conversion_events),
      'dernier_achat', (SELECT max(created_at) FROM public.meta_conversion_events
                          WHERE event_name = 'Purchase' AND status = 'sent'),
      -- Compare les paiements réellement encaissés aux Purchase envoyés.
      -- Un écart signale que Meta n'apprend pas ce qui se vend — et
      -- optimise donc les campagnes à l'aveugle.
      'paiements_24h', (SELECT count(*) FROM public.payments
                          WHERE status = 'completed'
                            AND completed_at >= now() - interval '24 hours'),
      'achats_24h',    (SELECT count(*) FROM public.meta_conversion_events
                          WHERE event_name = 'Purchase' AND status = 'sent'
                            AND created_at >= now() - interval '24 hours')
    ),

    -- ── Dernières erreurs ──
    'erreurs', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'quand' DESC)
      FROM (
        SELECT jsonb_build_object(
          'nom', event_name, 'code', error_code,
          'message', error_message, 'http', http_status,
          'quand', created_at
        ) AS x
        FROM public.meta_conversion_events
        WHERE status = 'failed' ORDER BY created_at DESC LIMIT 20
      ) t
    ), '[]'::jsonb),

    -- ── Audiences : effectifs mobilisables ──
    'audiences', jsonb_build_object(
      'visiteurs',  v_visites,
      'inscrits',   (SELECT count(*) FROM public.profiles),
      'profils',    (SELECT count(*) FROM public.profiles p
                       WHERE public.profile_completion(p.id) >= 60),
      'actifs',     (SELECT count(*) FROM public.profiles
                       WHERE last_seen >= now() - interval '30 days'),
      'ont_like',   (SELECT count(DISTINCT swiper_id) FROM public.swipes
                       WHERE action IN ('like','superlike')),
      'ont_match',  (SELECT count(DISTINCT id) FROM public.profiles p
                       WHERE EXISTS (SELECT 1 FROM public.matches m
                                     WHERE m.user1_id = p.id OR m.user2_id = p.id)),
      'checkout',   (SELECT count(DISTINCT user_id) FROM public.payments),
      'abonnes',    (SELECT count(*) FROM public.profiles p
                       WHERE public.effective_level(p.id) > 0),
      'anciens',    (SELECT count(*) FROM public.profiles p
                       WHERE public.effective_level(p.id) = 0
                         AND EXISTS (SELECT 1 FROM public.payments pay
                                     WHERE pay.user_id = p.id AND pay.status = 'completed'))
    ),

    -- ── Provenances brutes ──
    'sources', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'n')::int DESC)
      FROM (
        SELECT jsonb_build_object('source', utm_source, 'n', count(*)::integer) AS x
        FROM public.ad_visits WHERE created_at >= v_deb AND utm_source IS NOT NULL
        GROUP BY utm_source
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_meta_ads(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_meta_ads(integer) TO authenticated;

-- ------------------------------------------------------------
-- 8. Réglages publics et secrets
-- ------------------------------------------------------------
-- L'identifiant du Pixel est PUBLIC par nature : il part dans le
-- navigateur de chaque visiteur. Il a donc sa place dans `app_settings`.
INSERT INTO public.app_settings (key, value, label) VALUES
  ('meta_pixel_id',   '""'::jsonb, 'Identifiant du Meta Pixel / Dataset'),
  ('meta_domain',     '"agapemeet.com"'::jsonb, 'Domaine vérifié chez Meta'),
  ('meta_test_code',  '""'::jsonb, 'Code d''événement de test (Test Event Code)'),
  ('meta_mode',       '"test"'::jsonb, 'Mode d''envoi : test ou production'),
  ('meta_capi_active','false'::jsonb, 'Conversions API activée')
ON CONFLICT (key) DO NOTHING;

-- Le jeton d'accès, lui, ne doit JAMAIS quitter le serveur. Il va dans
-- les secrets de la fonction Edge (META_ACCESS_TOKEN), pas ici : même
-- `server_secrets` serait de trop, puisque rien en base n'en a besoin.

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name LIKE 'utm_%')          AS colonnes_utm,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name IN ('ad_visits','meta_conversion_events'))          AS tables_creees,
  (SELECT count(*) FROM public.app_settings WHERE key LIKE 'meta_%')     AS reglages;
