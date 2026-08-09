-- ============================================================
-- Moteur de cycle de vie — e-mails automatiques
-- ============================================================
-- CE QUI MANQUAIT
--
-- Aucune tâche planifiée n'existait. Tout ce qui dépend du temps —
-- accueil des nouveaux, relance avant expiration, réveil d'un inactif —
-- n'avait aucun moteur pour se déclencher.
--
-- Deux gabarits étaient d'ailleurs écrits et jamais appelés :
-- `subscriptionExpiringEmail` et `newMatchEmail`. Du code mort, alors
-- que la relance avant expiration est le levier de réabonnement le plus
-- rentable qui existe.
--
-- COMMENT ÇA MARCHE
--
-- La base répond à une seule question : « qui doit recevoir quoi
-- aujourd'hui ? » La fonction Edge se contente d'envoyer.
--
-- Le calcul reste ICI, en SQL, parce que c'est là que sont les données :
-- rapatrier tous les profils dans une fonction Edge pour les filtrer en
-- JavaScript coûterait cent fois plus cher.
--
-- LA RELANCE DE PAIEMENT ABANDONNÉ N'EST PAS INCLUSE : Chariow s'en
-- charge de son côté. Dupliquer produirait deux relances pour un même
-- panier — le meilleur moyen de faire fuir un acheteur hésitant.
--
-- AJOUT PUR : une fonction, une planification. Rien n'est modifié.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 1. Qui doit recevoir quoi aujourd'hui
-- ------------------------------------------------------------
-- Chaque ligne porte sa `cle_unique`. La fonction Edge la transmet à
-- `can_send_email`, qui refuse un doublon : une relance J-3 ne peut pas
-- partir deux fois, même si la tâche est relancée à la main.
CREATE OR REPLACE FUNCTION public.lifecycle_targets()
RETURNS TABLE (
  user_id     uuid,
  email       text,
  prenom      text,
  modele      text,
  cle_unique  text,
  donnees     jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$

-- ── Bienvenue, le jour de l'inscription ──
SELECT p.id, u.email, p.first_name,
       'bienvenue',
       'bienvenue-' || p.id::text,
       jsonb_build_object()
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.created_at >= now() - interval '1 day'
  AND NOT public.is_suspended(p.id)

UNION ALL

-- ── J+1 : profil incomplet ──
-- Un profil sous 60 % remonte mal dans la découverte : le membre ne
-- reçoit rien, conclut que l'application est vide, et part.
SELECT p.id, u.email, p.first_name,
       'profil_incomplet',
       'profil-' || p.id::text,
       jsonb_build_object('completion', public.profile_completion(p.id))
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.created_at::date = (now() - interval '1 day')::date
  AND public.profile_completion(p.id) < 60
  AND NOT public.is_suspended(p.id)

UNION ALL

-- ── J+3 : n'a jamais swipé ──
SELECT p.id, u.email, p.first_name,
       'jamais_swipe',
       'jamais-swipe-' || p.id::text,
       jsonb_build_object()
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.created_at::date = (now() - interval '3 days')::date
  AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id = p.id)
  AND NOT public.is_suspended(p.id)

UNION ALL

-- ── J+7 : témoignages ──
SELECT p.id, u.email, p.first_name,
       'semaine_un',
       'semaine1-' || p.id::text,
       jsonb_build_object()
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.created_at::date = (now() - interval '7 days')::date
  AND NOT public.is_suspended(p.id)

UNION ALL

-- ── J-3 avant expiration ──
-- La clé porte la DATE d'expiration : un membre qui se réabonne
-- plusieurs fois doit pouvoir être relancé à chaque échéance, sans que
-- la déduplication de la précédente l'en empêche.
SELECT p.id, u.email, p.first_name,
       'expire_3j',
       'exp3-' || p.id::text || '-' || s.expires_at::date::text,
       jsonb_build_object('expire_le', s.expires_at, 'plan', s.plan_id)
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
JOIN public.subscriptions s ON s.user_id = p.id
WHERE s.expires_at::date = (now() + interval '3 days')::date
  AND NOT public.is_suspended(p.id)

UNION ALL

-- ── J-1 avant expiration ──
SELECT p.id, u.email, p.first_name,
       'expire_1j',
       'exp1-' || p.id::text || '-' || s.expires_at::date::text,
       jsonb_build_object('expire_le', s.expires_at, 'plan', s.plan_id)
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
JOIN public.subscriptions s ON s.user_id = p.id
WHERE s.expires_at::date = (now() + interval '1 day')::date
  AND NOT public.is_suspended(p.id)

UNION ALL

-- ── J+2 après expiration ──
-- `effective_level = 0` vérifie qu'il n'a pas déjà repris un abonnement
-- entre-temps : lui annoncer une perte qu'il a réparée serait absurde.
SELECT p.id, u.email, p.first_name,
       'expire_depuis',
       'expfin-' || p.id::text || '-' || s.expires_at::date::text,
       jsonb_build_object('expire_le', s.expires_at)
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
JOIN public.subscriptions s ON s.user_id = p.id
WHERE s.expires_at::date = (now() - interval '2 days')::date
  AND public.effective_level(p.id) = 0
  AND NOT public.is_suspended(p.id)

UNION ALL

-- ── Gratuit actif : le moment de proposer Premium ──
-- Trois matchs ou plus, donc il a rencontré la limite de messages. On ne
-- vend pas à quelqu'un qui n'a pas encore vu le mur.
--
-- La clé porte le MOIS : au plus une proposition tous les trente jours.
SELECT p.id, u.email, p.first_name,
       'passer_premium',
       'premium-' || p.id::text || '-' || to_char(now(), 'YYYY-MM'),
       jsonb_build_object(
         'matchs', (SELECT count(*) FROM public.matches m
                    WHERE m.user1_id = p.id OR m.user2_id = p.id))
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE public.effective_level(p.id) = 0
  AND p.last_seen >= now() - interval '3 days'
  AND (SELECT count(*) FROM public.matches m
       WHERE m.user1_id = p.id OR m.user2_id = p.id) >= 3
  AND NOT public.is_suspended(p.id)

UNION ALL

-- ── Réveil à 14 jours d'absence ──
-- Un seul envoi, jamais répété : la clé ne contient pas de date.
SELECT p.id, u.email, p.first_name,
       'reveil',
       'reveil-' || p.id::text,
       jsonb_build_object(
         'likes', (SELECT count(*) FROM public.swipes s
                   WHERE s.target_id = p.id AND s.action IN ('like','superlike')))
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.last_seen::date = (now() - interval '14 days')::date
  AND NOT public.is_suspended(p.id)

UNION ALL

-- ── Résumé quotidien des messages non lus ──
-- UN résumé, jamais un e-mail par message. Dix conversations actives
-- produiraient dix envois — et c'est exactement ainsi qu'on déclenche
-- des plaintes, qui finissent par empêcher les e-mails d'inscription
-- d'arriver puisqu'ils partent du même domaine.
SELECT p.id, u.email, p.first_name,
       'messages_non_lus',
       'digest-' || p.id::text || '-' || now()::date::text,
       jsonb_build_object('n', t.n, 'de', t.de)
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
JOIN LATERAL (
  SELECT count(*)::int AS n,
         count(DISTINCT m.sender_id)::int AS de
  FROM public.messages m
  JOIN public.matches ma ON ma.id = m.match_id
  WHERE m.sender_id <> p.id
    AND m.read_at IS NULL
    AND m.created_at >= now() - interval '24 hours'
    AND (ma.user1_id = p.id OR ma.user2_id = p.id)
) t ON TRUE
WHERE t.n > 0
  -- Inutile de prévenir quelqu'un qui vient de fermer l'application.
  AND p.last_seen < now() - interval '6 hours'
  AND NOT public.is_suspended(p.id);
$$;

REVOKE ALL ON FUNCTION public.lifecycle_targets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifecycle_targets() TO service_role;

-- ------------------------------------------------------------
-- 2. Déclenchement quotidien
-- ------------------------------------------------------------
-- 08 h UTC, soit 08 h à Lomé et Abidjan, 09 h à Douala. Le matin plutôt
-- que le soir : un e-mail lu au réveil rouvre l'application dans la
-- journée, un e-mail de 22 h est enterré avant le lendemain.
INSERT INTO public.server_secrets (key, value) VALUES
  ('lifecycle_endpoint',
   'https://VOTRE-PROJET.supabase.co/functions/v1/daily-lifecycle')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.declencher_lifecycle()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT value INTO v_url    FROM public.server_secrets WHERE key = 'lifecycle_endpoint';
  SELECT value INTO v_secret FROM public.server_secrets WHERE key = 'push_secret';

  IF v_url IS NULL OR v_url LIKE '%VOTRE-PROJET%' THEN
    RAISE NOTICE 'lifecycle_endpoint non configuré — envoi ignoré';
    RETURN;
  END IF;

  -- Le même secret partagé que pour le push : la fonction peut écrire à
  -- n'importe qui, elle ne doit jamais être ouverte.
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body    := jsonb_build_object('source', 'cron')
  );
END;
$$;

-- Reprogrammer sans dupliquer : `cron.schedule` sur un nom existant
-- remplace la planification.
SELECT cron.unschedule('agape-lifecycle')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agape-lifecycle');

SELECT cron.schedule(
  'agape-lifecycle',
  '0 8 * * *',
  $$SELECT public.declencher_lifecycle();$$
);

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM cron.job WHERE jobname = 'agape-lifecycle') AS tache_planifiee,
  (SELECT count(*) FROM public.server_secrets
    WHERE key = 'lifecycle_endpoint' AND value NOT LIKE '%VOTRE-PROJET%') AS endpoint_configure,
  (SELECT count(*) FROM public.lifecycle_targets()) AS envois_aujourd_hui;
