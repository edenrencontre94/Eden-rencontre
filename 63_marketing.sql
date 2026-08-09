-- ============================================================
-- Marketing — acquisition, activation, segments, canaux
-- ============================================================
-- CE QUI MANQUAIT
--
-- La page Marketing ne connaissait qu'un seul canal : l'e-mail. Elle
-- ignorait les notifications push — pourtant en place depuis la
-- migration 58 — et n'avait aucune notion d'acquisition, de segment ou
-- de cycle de vie.
--
-- LE GASPILLAGE LE PLUS COÛTEUX
--
-- L'inscription demande à CHAQUE nouveau membre par quel canal il a
-- connu AgapeMeet — TikTok, Instagram, Facebook, YouTube, une
-- recommandation. La réponse était collectée, affichée à l'écran…  et
-- jetée : aucune colonne ne l'accueillait.
--
-- C'est la donnée qui dit où placer un budget publicitaire. Sans elle,
-- toute dépense d'acquisition est aveugle.
--
-- AJOUT PUR : deux colonnes, une fonction, deux index. Rien n'est
-- modifié ni supprimé.

-- ------------------------------------------------------------
-- 1. La source d'acquisition
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acquisition_source text;

CREATE INDEX IF NOT EXISTS profiles_acquisition_idx
  ON public.profiles (acquisition_source)
  WHERE acquisition_source IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Les campagnes gagnent un canal et une cible
-- ------------------------------------------------------------
-- Jusqu'ici, une campagne partait à TOUS les inscrits au marketing.
-- Envoyer la même chose à un nouveau venu et à un abonné dont la
-- formule expire demain gaspille les deux occasions.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS segment text NOT NULL DEFAULT 'tous';

-- ------------------------------------------------------------
-- 3. Effectif d'un segment
-- ------------------------------------------------------------
-- Une seule définition, réutilisée par l'affichage ET par l'envoi :
-- deux définitions séparées finiraient par diverger, et l'on enverrait
-- à un public différent de celui annoncé.
CREATE OR REPLACE FUNCTION public.segment_membres(p_segment text)
RETURNS TABLE (user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p
  WHERE
    CASE p_segment
      -- Inscrits cette semaine : accueil, prise en main.
      WHEN 'nouveaux' THEN
        p.created_at >= now() - interval '7 days'

      -- Absents depuis deux semaines à deux mois. Au-delà, un message
      -- de réveil devient une intrusion plus qu'un rappel.
      WHEN 'inactifs' THEN
        p.last_seen < now() - interval '14 days'
        AND p.last_seen > now() - interval '60 days'

      -- Gratuits ayant déjà au moins trois matchs : ils vivent la
      -- limite de cinq messages par jour. C'est le segment qui convertit.
      WHEN 'gratuit_actif' THEN
        public.effective_level(p.id) = 0
        AND (SELECT count(*) FROM public.matches m
             WHERE m.user1_id = p.id OR m.user2_id = p.id) >= 3

      -- Abonnement finissant sous sept jours.
      WHEN 'expire_bientot' THEN
        EXISTS (SELECT 1 FROM public.subscriptions s
                WHERE s.user_id = p.id
                  AND s.expires_at BETWEEN now() AND now() + interval '7 days')

      -- Expiré depuis moins d'un mois : la fenêtre de réabonnement.
      WHEN 'expire_recemment' THEN
        public.effective_level(p.id) = 0
        AND EXISTS (SELECT 1 FROM public.subscriptions s
                    WHERE s.user_id = p.id
                      AND s.expires_at BETWEEN now() - interval '30 days' AND now())

      -- Profil sous 60 % : ils sont peu visibles, donc peu sollicités,
      -- donc partis avant d'avoir rien vécu.
      WHEN 'profil_incomplet' THEN
        public.profile_completion(p.id) < 60

      -- Inscrits qui n'ont jamais swipé : ils n'ont pas commencé.
      WHEN 'jamais_swipe' THEN
        NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id = p.id)

      ELSE TRUE  -- 'tous'
    END
    -- Exclusions valables pour TOUS les segments : un compte supprimé,
    -- suspendu ou en pause ne doit jamais recevoir de sollicitation.
    AND COALESCE(p.visibility, 'tous') <> 'pause'
    AND NOT public.is_suspended(p.id);
$$;

REVOKE ALL ON FUNCTION public.segment_membres(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.segment_membres(text) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Le tableau de bord
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_marketing(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deb      timestamp with time zone;
  v_membres  integer;
  v_email    integer;
  v_push     integer;
  v_joignable integer;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_deb := now() - make_interval(days => GREATEST(1, p_days));

  SELECT count(*) INTO v_membres FROM public.profiles;

  SELECT count(*) INTO v_email
  FROM public.email_preferences WHERE marketing = true;

  SELECT count(DISTINCT user_id) INTO v_push FROM public.push_subscriptions;

  -- Joignables par AU MOINS un canal. La somme des deux compterait deux
  -- fois ceux qui acceptent l'e-mail et le push — et surestimerait la
  -- portée réelle d'une annonce.
  SELECT count(*) INTO v_joignable
  FROM public.profiles p
  WHERE EXISTS (SELECT 1 FROM public.email_preferences e
                WHERE e.user_id = p.id AND e.marketing = true)
     OR EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p.id);

  RETURN jsonb_build_object(
    'periode_jours', p_days,

    -- ── Portée par canal ──
    'portee', jsonb_build_object(
      'membres', v_membres,
      'email', v_email,
      'push', v_push,
      'joignables', v_joignable,
      'taux', CASE WHEN v_membres > 0
                THEN round(v_joignable * 100.0 / v_membres, 1) ELSE 0 END
    ),

    -- ── D'où viennent les membres ──
    'acquisition', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'n')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'source', COALESCE(p.acquisition_source, 'inconnu'),
          'n', count(*)::integer,
          'periode', count(*) FILTER (WHERE p.created_at >= v_deb)::integer,
          'payants', count(*) FILTER (WHERE public.effective_level(p.id) > 0)::integer
        ) AS x
        FROM public.profiles p
        GROUP BY COALESCE(p.acquisition_source, 'inconnu')
      ) t
    ), '[]'::jsonb),

    -- ── Entonnoir d'activation ──
    -- Chaque marche indique où l'on perd les gens. Le compte brut ne dit
    -- rien ; c'est l'écart entre deux marches qui désigne le problème.
    'entonnoir', jsonb_build_object(
      'inscrits',  (SELECT count(*) FROM public.profiles WHERE created_at >= v_deb),
      'photo',     (SELECT count(*) FROM public.profiles
                      WHERE created_at >= v_deb AND COALESCE(array_length(photos,1),0) > 0),
      'swipe',     (SELECT count(DISTINCT s.swiper_id) FROM public.swipes s
                      JOIN public.profiles p ON p.id = s.swiper_id WHERE p.created_at >= v_deb),
      'match',     (SELECT count(DISTINCT p.id) FROM public.profiles p
                      WHERE p.created_at >= v_deb
                        AND EXISTS (SELECT 1 FROM public.matches m
                                    WHERE m.user1_id = p.id OR m.user2_id = p.id)),
      'message',   (SELECT count(DISTINCT m.sender_id) FROM public.messages m
                      JOIN public.profiles p ON p.id = m.sender_id WHERE p.created_at >= v_deb),
      'payant',    (SELECT count(DISTINCT pay.user_id) FROM public.payments pay
                      JOIN public.profiles p ON p.id = pay.user_id
                      WHERE p.created_at >= v_deb AND pay.status = 'completed')
    ),

    -- ── Segments actionnables ──
    'segments', jsonb_build_array(
      jsonb_build_object('cle','nouveaux','label','Inscrits cette semaine',
        'n',(SELECT count(*) FROM public.segment_membres('nouveaux')),
        'quoi','Message de bienvenue, prise en main'),
      jsonb_build_object('cle','jamais_swipe','label','N''ont jamais swipé',
        'n',(SELECT count(*) FROM public.segment_membres('jamais_swipe')),
        'quoi','Ils ne sont jamais entrés dans l''application'),
      jsonb_build_object('cle','profil_incomplet','label','Profil sous 60 %',
        'n',(SELECT count(*) FROM public.segment_membres('profil_incomplet')),
        'quoi','Peu visibles, donc peu sollicités'),
      jsonb_build_object('cle','gratuit_actif','label','Gratuits avec 3 matchs ou plus',
        'n',(SELECT count(*) FROM public.segment_membres('gratuit_actif')),
        'quoi','Ils vivent la limite de 5 messages — le segment qui convertit'),
      jsonb_build_object('cle','expire_bientot','label','Abonnement expire sous 7 jours',
        'n',(SELECT count(*) FROM public.segment_membres('expire_bientot')),
        'quoi','Relance avant échéance'),
      jsonb_build_object('cle','expire_recemment','label','Expirés depuis moins d''un mois',
        'n',(SELECT count(*) FROM public.segment_membres('expire_recemment')),
        'quoi','Fenêtre de réabonnement'),
      jsonb_build_object('cle','inactifs','label','Inactifs depuis 14 jours',
        'n',(SELECT count(*) FROM public.segment_membres('inactifs')),
        'quoi','Réveil — au-delà de 60 jours, on n''insiste plus')
    ),

    -- ── Campagnes ──
    'campagnes', jsonb_build_object(
      'total',        (SELECT count(*) FROM public.campaigns),
      'periode',      (SELECT count(*) FROM public.campaigns WHERE created_at >= v_deb),
      'destinataires',(SELECT COALESCE(sum(recipients),0) FROM public.campaigns WHERE status='sent'),
      'delivres',     (SELECT COALESCE(sum(delivered),0) FROM public.campaigns WHERE status='sent'),
      'ignores',      (SELECT COALESCE(sum(skipped),0) FROM public.campaigns WHERE status='sent')
    ),

    -- ── Santé d'envoi ──
    -- Au-delà de 0,3 % de plaintes, Gmail déclasse le domaine — et les
    -- e-mails de confirmation d'inscription cessent d'arriver avec.
    'delivrabilite', jsonb_build_object(
      'supprimes', (SELECT count(*) FROM public.email_suppression),
      'rebonds',   (SELECT count(*) FROM public.email_suppression WHERE reason = 'bounce'),
      'plaintes',  (SELECT count(*) FROM public.email_suppression WHERE reason = 'complaint'),
      'envois_30j',(SELECT count(*) FROM public.email_log WHERE sent_at >= now() - interval '30 days'),
      'taux_plainte', (
        SELECT CASE WHEN count(*) > 0 THEN round(
          (SELECT count(*) FROM public.email_suppression WHERE reason='complaint') * 100.0 / count(*), 3)
        ELSE 0 END
        FROM public.email_log WHERE sent_at >= now() - interval '30 days')
    ),

    -- ── Ce que ça rapporte ──
    'revenus', jsonb_build_object(
      'periode',  (SELECT COALESCE(sum(amount_xof),0) FROM public.payments
                     WHERE status='completed' AND completed_at >= v_deb),
      'total',    (SELECT COALESCE(sum(amount_xof),0) FROM public.payments WHERE status='completed'),
      'payants',  (SELECT count(DISTINCT user_id) FROM public.payments WHERE status='completed'),
      'panier',   (SELECT COALESCE(round(avg(amount_xof)),0) FROM public.payments
                     WHERE status='completed' AND completed_at >= v_deb)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_marketing(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_marketing(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT public.admin_marketing(30);
