-- ============================================================
-- Analytics — indicateurs détaillés
-- ============================================================
-- La page ne montrait que des volumes : inscriptions, matchs, messages,
-- revenus. Des volumes disent ce qui s'est passé, pas ce qui fonctionne.
--
-- Ce qui est ajouté ici répond à des questions précises :
--   • Grandit-on vraiment ? (inscriptions MOINS départs)
--   • Les gens se répondent-ils ? (taux de réciprocité, de réponse)
--   • Reviennent-ils ? (rétention par cohorte)
--   • Rachètent-ils ? (taux de réabonnement, délai avant premier achat)
--   • Combien restent invisibles ? (aucun like reçu, aucun match)
--
-- Les clés existantes sont conservées : la page actuelle continue de
-- fonctionner pendant que la nouvelle se met en place.

CREATE OR REPLACE FUNCTION public.admin_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from   date;
  v_to     date;
  v_now    timestamp with time zone := timezone('utc'::text, now());
  v_deb    timestamp with time zone;
  v_membres  integer;
  v_actifs30 integer;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  p_days := GREATEST(7, LEAST(COALESCE(p_days, 30), 365));
  v_to   := v_now::date;
  v_from := v_to - p_days + 1;
  v_deb  := v_from::timestamp with time zone;

  SELECT count(*) INTO v_membres FROM public.profiles;
  SELECT count(*) INTO v_actifs30 FROM public.profiles
  WHERE last_seen >= v_now - interval '30 days';

  RETURN jsonb_build_object(
    'range_days', p_days,
    'from', v_from,
    'to', v_to,

    -- ══════════════════════════════════════════════════════
    -- SÉRIES QUOTIDIENNES
    -- ══════════════════════════════════════════════════════
    'signups', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('d', g.d, 'n', COALESCE(c.n, 0)) ORDER BY g.d), '[]'::jsonb)
      FROM generate_series(v_from, v_to, '1 day'::interval) AS g(d)
      LEFT JOIN (
        SELECT created_at::date AS dd, count(*) AS n
        FROM public.profiles WHERE created_at::date >= v_from GROUP BY 1
      ) c ON c.dd = g.d::date
    ),
    'matches', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('d', g.d, 'n', COALESCE(c.n, 0)) ORDER BY g.d), '[]'::jsonb)
      FROM generate_series(v_from, v_to, '1 day'::interval) AS g(d)
      LEFT JOIN (
        SELECT created_at::date AS dd, count(*) AS n
        FROM public.matches WHERE created_at::date >= v_from GROUP BY 1
      ) c ON c.dd = g.d::date
    ),
    'messages', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('d', g.d, 'n', COALESCE(c.n, 0)) ORDER BY g.d), '[]'::jsonb)
      FROM generate_series(v_from, v_to, '1 day'::interval) AS g(d)
      LEFT JOIN (
        SELECT created_at::date AS dd, count(*) AS n
        FROM public.messages WHERE created_at::date >= v_from GROUP BY 1
      ) c ON c.dd = g.d::date
    ),
    'revenue', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('d', g.d, 'n', COALESCE(c.n, 0)) ORDER BY g.d), '[]'::jsonb)
      FROM generate_series(v_from, v_to, '1 day'::interval) AS g(d)
      LEFT JOIN (
        SELECT completed_at::date AS dd, sum(amount_xof) AS n
        FROM public.payments
        WHERE status = 'completed' AND completed_at::date >= v_from
        GROUP BY 1
      ) c ON c.dd = g.d::date
    ),
    -- Départs : la courbe qui manquait. Sans elle, une croissance de 100
    -- inscriptions pour 90 départs ressemble à une croissance de 100.
    'departures', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('d', g.d, 'n', COALESCE(c.n, 0)) ORDER BY g.d), '[]'::jsonb)
      FROM generate_series(v_from, v_to, '1 day'::interval) AS g(d)
      LEFT JOIN (
        SELECT created_at::date AS dd, count(*) AS n
        FROM public.account_deletions WHERE created_at::date >= v_from GROUP BY 1
      ) c ON c.dd = g.d::date
    ),

    -- ══════════════════════════════════════════════════════
    -- TOTAUX (clés d'origine conservées)
    -- ══════════════════════════════════════════════════════
    'totals', jsonb_build_object(
      'members',        v_membres,
      'new_members',    (SELECT count(*) FROM public.profiles WHERE created_at::date >= v_from),
      'active_7d',      (SELECT count(*) FROM public.profiles
                         WHERE last_seen >= v_now - interval '7 days'),
      'active_30d',     v_actifs30,
      'paying',         (SELECT count(*) FROM public.subscriptions
                         WHERE plan_id <> 'gratuit' AND expires_at > v_now),
      'revenue_total',  (SELECT COALESCE(sum(amount_xof), 0) FROM public.payments WHERE status = 'completed'),
      'revenue_period', (SELECT COALESCE(sum(amount_xof), 0) FROM public.payments
                         WHERE status = 'completed' AND completed_at::date >= v_from),
      'orders_period',  (SELECT count(*) FROM public.payments
                         WHERE status = 'completed' AND completed_at::date >= v_from),
      'pending',        (SELECT count(*) FROM public.payments WHERE status = 'pending'),
      'failed_period',  (SELECT count(*) FROM public.payments
                         WHERE status = 'failed' AND created_at::date >= v_from)
    ),

    -- ══════════════════════════════════════════════════════
    -- CROISSANCE NETTE
    -- ══════════════════════════════════════════════════════
    'croissance', jsonb_build_object(
      'inscriptions', (SELECT count(*) FROM public.profiles WHERE created_at >= v_deb),
      'departs',      (SELECT count(*) FROM public.account_deletions WHERE created_at >= v_deb),
      'nette',        (SELECT count(*) FROM public.profiles WHERE created_at >= v_deb)
                      - (SELECT count(*) FROM public.account_deletions WHERE created_at >= v_deb),
      -- Un départ « j'ai rencontré quelqu'un » est un succès. Le compter
      -- comme une perte fausserait la lecture de la santé du service.
      'departs_succes', (SELECT count(*) FROM public.account_deletions
                         WHERE created_at >= v_deb AND reason = 'trouve_partenaire'),
      'suspendus',    (SELECT count(*) FROM public.profiles
                       WHERE suspended_until IS NOT NULL AND suspended_until > v_now)
    ),

    -- ══════════════════════════════════════════════════════
    -- ENGAGEMENT
    -- ══════════════════════════════════════════════════════
    'engagement', jsonb_build_object(
      'likes',      (SELECT count(*) FROM public.swipes
                     WHERE action IN ('like', 'superlike') AND created_at >= v_deb),
      'passes',     (SELECT count(*) FROM public.swipes
                     WHERE action = 'pass' AND created_at >= v_deb),
      'superlikes', (SELECT count(*) FROM public.swipes
                     WHERE action = 'superlike' AND created_at >= v_deb),
      'boosts',     (SELECT count(*) FROM public.boosts WHERE started_at >= v_deb),
      'publications',(SELECT count(*) FROM public.community_posts WHERE created_at >= v_deb),
      'visites',    (SELECT count(*) FROM public.profile_visits WHERE created_at >= v_deb),

      -- Part des likes qui deviennent des matchs. Un taux faible signale
      -- soit un déséquilibre de la base, soit des profils mal ciblés.
      'taux_reciprocite', (
        SELECT CASE WHEN l = 0 THEN NULL ELSE ROUND((m::numeric * 2 / l) * 100, 1) END
        FROM (
          SELECT
            (SELECT count(*) FROM public.swipes
             WHERE action IN ('like','superlike') AND created_at >= v_deb) AS l,
            (SELECT count(*) FROM public.matches WHERE created_at >= v_deb) AS m
        ) x
      ),

      -- Part des matchs où AU MOINS UN message a été envoyé. C'est le
      -- premier décrochage : un match sans conversation ne sert à rien.
      'taux_engagement_match', (
        SELECT CASE WHEN total = 0 THEN NULL
               ELSE ROUND((avec::numeric / total) * 100, 1) END
        FROM (
          SELECT
            count(*) AS total,
            count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM public.messages ms WHERE ms.match_id = mt.id)) AS avec
          FROM public.matches mt WHERE mt.created_at >= v_deb
        ) x
      ),

      -- Part des conversations où les DEUX ont écrit. C'est la vraie
      -- mesure d'une rencontre : un monologue n'en est pas une.
      'taux_reponse', (
        SELECT CASE WHEN total = 0 THEN NULL
               ELSE ROUND((reciproque::numeric / total) * 100, 1) END
        FROM (
          SELECT
            count(*) AS total,
            count(*) FILTER (WHERE (
              SELECT count(DISTINCT ms.sender_id) FROM public.messages ms
              WHERE ms.match_id = mt.id) >= 2) AS reciproque
          FROM public.matches mt
          WHERE mt.created_at >= v_deb
            AND EXISTS (SELECT 1 FROM public.messages ms WHERE ms.match_id = mt.id)
        ) x
      ),

      'messages_par_match', (
        SELECT CASE WHEN m = 0 THEN NULL ELSE ROUND(msg::numeric / m, 1) END
        FROM (
          SELECT
            (SELECT count(*) FROM public.matches WHERE created_at >= v_deb) AS m,
            (SELECT count(*) FROM public.messages WHERE created_at >= v_deb) AS msg
        ) x
      ),

      -- Rapport actifs du jour sur actifs du mois : à quelle fréquence on
      -- revient. Au-dessus de 20 %, l'application fait partie du quotidien.
      'adhesion', (
        SELECT CASE WHEN v_actifs30 = 0 THEN NULL
               ELSE ROUND((count(*)::numeric / v_actifs30) * 100, 1) END
        FROM public.profiles WHERE last_seen >= v_now - interval '1 day'
      )
    ),

    -- ══════════════════════════════════════════════════════
    -- QUALITÉ DE L'EXPÉRIENCE
    -- ══════════════════════════════════════════════════════
    -- Les moyennes masquent ceux pour qui rien ne se passe. Ces trois
    -- chiffres les comptent.
    'experience', jsonb_build_object(
      'sans_like_recu', (
        SELECT count(*) FROM public.profiles p
        WHERE NOT EXISTS (
          SELECT 1 FROM public.swipes s
          WHERE s.target_id = p.id AND s.action IN ('like', 'superlike'))
      ),
      'sans_match', (
        SELECT count(*) FROM public.profiles p
        WHERE NOT EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.user1_id = p.id OR m.user2_id = p.id)
      ),
      'sans_photo', (
        SELECT count(*) FROM public.profiles
        WHERE photos IS NULL OR array_length(photos, 1) IS NULL
      ),
      'completion_moyenne', (
        SELECT ROUND(AVG(public.profile_completion(id))::numeric, 0)
        FROM (SELECT id FROM public.profiles ORDER BY created_at DESC LIMIT 500) s
      )
    ),

    -- ══════════════════════════════════════════════════════
    -- RÉTENTION PAR COHORTE
    -- ══════════════════════════════════════════════════════
    -- Une moyenne globale de rétention mélange les anciens et les
    -- nouveaux. Par cohorte mensuelle, on voit si les arrivants de ce
    -- mois-ci restent mieux que ceux du mois dernier.
    'cohortes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'mois', to_char(mois, 'YYYY-MM'),
        'inscrits', n,
        'actifs_j7', j7,
        'actifs_j30', j30,
        'retention_j30', CASE WHEN n = 0 THEN NULL
                         ELSE ROUND((j30::numeric / n) * 100, 0) END
      ) ORDER BY mois DESC)
      FROM (
        SELECT
          date_trunc('month', created_at) AS mois,
          count(*) AS n,
          count(*) FILTER (WHERE last_seen >= created_at + interval '7 days')  AS j7,
          count(*) FILTER (WHERE last_seen >= created_at + interval '30 days') AS j30
        FROM public.profiles
        WHERE created_at >= v_now - interval '6 months'
        GROUP BY 1
      ) c
    ), '[]'::jsonb),

    -- ══════════════════════════════════════════════════════
    -- MONÉTISATION
    -- ══════════════════════════════════════════════════════
    'monetisation', jsonb_build_object(
      'panier_moyen', (
        SELECT COALESCE(ROUND(AVG(amount_xof))::integer, 0)
        FROM public.payments WHERE status = 'completed'
      ),
      'payants_uniques', (
        SELECT count(DISTINCT user_id) FROM public.payments WHERE status = 'completed'
      ),
      'taux_conversion', (
        SELECT CASE WHEN v_membres = 0 THEN 0
               ELSE ROUND((count(DISTINCT user_id)::numeric / v_membres) * 100, 1) END
        FROM public.payments WHERE status = 'completed'
      ),
      -- Part des payants qui ont racheté. C'est l'indicateur le plus
      -- révélateur : on ne renouvelle que si le service a tenu sa promesse.
      'taux_reachat', (
        SELECT CASE WHEN total = 0 THEN NULL
               ELSE ROUND((repeat::numeric / total) * 100, 1) END
        FROM (
          SELECT count(*) AS total, count(*) FILTER (WHERE n > 1) AS repeat
          FROM (
            SELECT user_id, count(*) AS n FROM public.payments
            WHERE status = 'completed' GROUP BY user_id
          ) y
        ) x
      ),
      -- Combien de jours entre l'inscription et le premier paiement.
      -- Un délai court signale une promesse claire dès l'arrivée.
      'jours_avant_achat', (
        SELECT ROUND(percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(DAY FROM premier - inscrit))::numeric, 0)
        FROM (
          SELECT p.created_at AS inscrit,
                 (SELECT min(pay.completed_at) FROM public.payments pay
                  WHERE pay.user_id = p.id AND pay.status = 'completed') AS premier
          FROM public.profiles p
        ) z WHERE premier IS NOT NULL
      ),
      'revenu_boosts', (
        SELECT COALESCE(sum(amount_xof), 0) FROM public.payments
        WHERE status = 'completed' AND offer_id LIKE 'boost%'
      ),
      'revenu_abonnements', (
        SELECT COALESCE(sum(amount_xof), 0) FROM public.payments
        WHERE status = 'completed' AND offer_id NOT LIKE 'boost%'
      ),
      'echecs_periode', (
        SELECT count(*) FROM public.payments
        WHERE status = 'failed' AND created_at >= v_deb
      ),
      'taux_echec', (
        SELECT CASE WHEN total = 0 THEN NULL
               ELSE ROUND((rates::numeric / total) * 100, 1) END
        FROM (
          SELECT count(*) AS total,
                 count(*) FILTER (WHERE status = 'failed') AS rates
          FROM public.payments WHERE created_at >= v_deb
        ) x
      )
    ),

    -- ══════════════════════════════════════════════════════
    -- SANTÉ ET MODÉRATION
    -- ══════════════════════════════════════════════════════
    'sante', jsonb_build_object(
      'signalements',        (SELECT count(*) FROM public.reports WHERE created_at >= v_deb),
      'signalements_ouverts',(SELECT count(*) FROM public.reports WHERE status = 'pending'),
      'blocages',            (SELECT count(*) FROM public.blocks WHERE created_at >= v_deb),
      'tickets_ouverts',     (SELECT count(*) FROM public.support_tickets
                              WHERE status IN ('open', 'pending')),
      -- Signalements rapportés aux membres actifs : un chiffre brut monte
      -- forcément avec la croissance, ce ratio non.
      'taux_signalement', (
        SELECT CASE WHEN v_actifs30 = 0 THEN NULL
               ELSE ROUND((count(*)::numeric / v_actifs30) * 100, 2) END
        FROM public.reports WHERE created_at >= v_deb
      ),
      'motifs', COALESCE((
        SELECT jsonb_object_agg(COALESCE(reason, 'non_precise'), n)
        FROM (SELECT reason, count(*) AS n FROM public.reports
              WHERE created_at >= v_deb GROUP BY reason) x
      ), '{}'::jsonb)
    ),

    -- ══════════════════════════════════════════════════════
    -- RÉPARTITIONS
    -- ══════════════════════════════════════════════════════
    'by_offer', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'offer_id', offer_id, 'n', n, 'revenue', revenue) ORDER BY revenue DESC), '[]'::jsonb)
      FROM (
        SELECT offer_id, count(*) AS n, sum(amount_xof) AS revenue
        FROM public.payments WHERE status = 'completed'
        GROUP BY offer_id
      ) x
    ),

    'funnel', jsonb_build_object(
      'inscrits',  v_membres,
      'ont_photo', (SELECT count(*) FROM public.profiles
                    WHERE photos IS NOT NULL AND array_length(photos, 1) >= 1),
      'ont_swipe', (SELECT count(DISTINCT swiper_id) FROM public.swipes),
      'ont_match', (SELECT count(*) FROM (
                      SELECT user1_id AS u FROM public.matches
                      UNION SELECT user2_id FROM public.matches) m),
      'ont_ecrit', (SELECT count(DISTINCT sender_id) FROM public.messages),
      'ont_paye',  (SELECT count(DISTINCT user_id) FROM public.payments WHERE status = 'completed')
    ),

    'by_country', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('k', COALESCE(country, 'Non renseigné'), 'n', n)
                                ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT country, count(*) AS n FROM public.profiles GROUP BY country
            ORDER BY n DESC LIMIT 8) x
    ),

    'by_gender', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('k', COALESCE(gender, 'Non renseigné'), 'n', n)), '[]'::jsonb)
      FROM (SELECT gender, count(*) AS n FROM public.profiles GROUP BY gender) x
    ),

    -- Tranches d'âge : sert à savoir si le discours de la plateforme
    -- s'adresse bien à celles et ceux qui s'y inscrivent.
    'by_age', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('k', tranche, 'n', n) ORDER BY ordre)
      FROM (
        SELECT
          CASE
            WHEN age < 25 THEN '18-24'
            WHEN age < 30 THEN '25-29'
            WHEN age < 35 THEN '30-34'
            WHEN age < 45 THEN '35-44'
            ELSE '45 et +'
          END AS tranche,
          CASE
            WHEN age < 25 THEN 1 WHEN age < 30 THEN 2
            WHEN age < 35 THEN 3 WHEN age < 45 THEN 4 ELSE 5
          END AS ordre,
          count(*) AS n
        FROM (
          SELECT EXTRACT(YEAR FROM age(birth_date))::integer AS age
          FROM public.profiles WHERE birth_date IS NOT NULL
        ) a
        GROUP BY 1, 2
      ) t
    ), '[]'::jsonb),

    'by_denomination', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('k', denomination, 'n', n) ORDER BY n DESC)
      FROM (
        SELECT denomination, count(*) AS n FROM public.profiles
        WHERE COALESCE(denomination, '') <> ''
        GROUP BY denomination ORDER BY n DESC LIMIT 8
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
SELECT public.admin_analytics(30) AS analytics;
