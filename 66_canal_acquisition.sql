-- ============================================================
-- Canal d'acquisition — déclaré et mesuré
-- ============================================================
-- DEUX SIGNAUX QUI NE DISENT PAS LA MÊME CHOSE
--
-- `acquisition_source` est ce que le membre RÉPOND à l'inscription :
-- « comment avez-vous connu AgapeMeet ? ». C'est une déclaration.
--
-- `utm_source` est ce qu'on MESURE : le paramètre présent dans l'URL au
-- moment du clic. C'est un fait.
--
-- Les deux divergent, et c'est instructif. Quelqu'un qui clique sur une
-- publicité Facebook peut très bien répondre « une recommandation » —
-- parce qu'un ami lui en a parlé d'abord, et que la publicité n'a fait
-- que déclencher le geste. La publicité a capté, l'ami a convaincu.
--
-- Confondre les deux ferait attribuer tout le mérite au dernier clic, et
-- conduirait à couper les budgets qui alimentent le bouche-à-oreille.
--
-- AJOUT PUR : une fonction. Rien n'est modifié.
--
-- ⚠️ La colonne `acquisition_source` vient de la migration 63. Si elle
--    n'a pas été exécutée, cette fonction échouera — c'est voulu : mieux
--    vaut une erreur explicite qu'un tableau vide inexpliqué.

CREATE OR REPLACE FUNCTION public.admin_acquisition(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deb    timestamp with time zone;
  v_total  integer;
  v_repond integer;
BEGIN
  -- Même garde que `admin_analytics` : cette page lui appartient.
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_deb := now() - make_interval(days => GREATEST(1, p_days));

  SELECT count(*) INTO v_total
  FROM public.profiles WHERE created_at >= v_deb;

  SELECT count(*) INTO v_repond
  FROM public.profiles
  WHERE created_at >= v_deb AND acquisition_source IS NOT NULL;

  RETURN jsonb_build_object(
    'periode_jours', p_days,
    'inscrits', v_total,
    'ont_repondu', v_repond,
    -- Un taux de réponse bas signale que la question est sautée : elle
    -- n'était peut-être pas obligatoire, ou l'écran s'affiche mal.
    'taux_reponse', CASE WHEN v_total > 0
                      THEN round(v_repond * 100.0 / v_total, 1) ELSE 0 END,

    -- ── Ce que les membres DÉCLARENT ──
    -- Chaque canal est suivi jusqu'au revenu : le volume seul ne dit rien.
    -- Un canal peut amener beaucoup de monde et aucun abonné.
    'declare', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'inscrits')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'canal',    q.canal,
          'inscrits', count(*)::integer,
          'actifs',   count(*) FILTER (WHERE q.actif)::integer,
          'profils',  count(*) FILTER (WHERE q.completion >= 60)::integer,
          'matchs',   count(*) FILTER (WHERE q.a_match)::integer,
          'payants',  count(*) FILTER (WHERE q.a_paye)::integer,
          'revenus',  COALESCE(sum(q.revenu), 0)
        ) AS x
        FROM (
          SELECT
            COALESCE(p.acquisition_source, 'non_renseigne') AS canal,
            p.last_seen >= now() - interval '30 days'       AS actif,
            public.profile_completion(p.id)                 AS completion,
            EXISTS (SELECT 1 FROM public.matches m
                    WHERE m.user1_id = p.id OR m.user2_id = p.id) AS a_match,
            EXISTS (SELECT 1 FROM public.payments pay
                    WHERE pay.user_id = p.id AND pay.status = 'completed') AS a_paye,
            COALESCE((SELECT sum(pay.amount_xof) FROM public.payments pay
                      WHERE pay.user_id = p.id AND pay.status = 'completed'), 0) AS revenu
          FROM public.profiles p
          WHERE p.created_at >= v_deb
        ) q
        GROUP BY q.canal
      ) t
    ), '[]'::jsonb),

    -- ── Ce qu'on MESURE dans l'URL ──
    'mesure', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'inscrits')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'source',   COALESCE(p.utm_source, 'direct'),
          'inscrits', count(*)::integer,
          'payants',  count(*) FILTER (WHERE EXISTS (
                        SELECT 1 FROM public.payments pay
                        WHERE pay.user_id = p.id AND pay.status = 'completed'))::integer
        ) AS x
        FROM public.profiles p
        WHERE p.created_at >= v_deb
        GROUP BY COALESCE(p.utm_source, 'direct')
      ) t
    ), '[]'::jsonb),

    -- ── Croisement ──
    -- Les membres arrivés par une publicité qui déclarent une autre
    -- origine. C'est la mesure du bouche-à-oreille amplifié par la
    -- publicité — invisible autrement, et systématiquement sous-estimé.
    'ecart', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'n')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'mesure',  p.utm_source,
          'declare', COALESCE(p.acquisition_source, 'non_renseigne'),
          'n',       count(*)::integer
        ) AS x
        FROM public.profiles p
        WHERE p.created_at >= v_deb AND p.utm_source IS NOT NULL
        GROUP BY p.utm_source, COALESCE(p.acquisition_source, 'non_renseigne')
      ) t
    ), '[]'::jsonb),

    -- ── Évolution ──
    'courbe', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'canal', canal, 'jours', jours
      ) ORDER BY canal)
      FROM (
        SELECT
          COALESCE(acquisition_source, 'non_renseigne') AS canal,
          jsonb_agg(jsonb_build_object('jour', j, 'n', n) ORDER BY j) AS jours
        FROM (
          SELECT acquisition_source, created_at::date AS j, count(*)::integer AS n
          FROM public.profiles
          WHERE created_at >= v_deb
          GROUP BY acquisition_source, created_at::date
        ) s
        GROUP BY COALESCE(acquisition_source, 'non_renseigne')
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_acquisition(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_acquisition(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Contrôle
SELECT public.admin_acquisition(30);
