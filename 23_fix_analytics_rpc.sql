-- ============================================================
-- 23_fix_analytics_rpc.sql
-- Corrige l'erreur "column liked does not exist"
-- dans admin_analytics (utilisation de la colonne action)
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_analytics(INT);

CREATE OR REPLACE FUNCTION public.admin_analytics(p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  since TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
  v_total INT;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT COUNT(*) INTO v_total FROM public.profiles;

  RETURN jsonb_build_object(
    'range_days', p_days,
    'from', since,
    'to', now(),
    'signups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('d', day::date, 'n', cnt))
      FROM (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS cnt
        FROM public.profiles WHERE created_at >= since
        GROUP BY 1 ORDER BY 1
      ) t
    ), '[]'),
    'matches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('d', day::date, 'n', cnt))
      FROM (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS cnt
        FROM public.matches WHERE created_at >= since
        GROUP BY 1 ORDER BY 1
      ) t
    ), '[]'),
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('d', day::date, 'n', cnt))
      FROM (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS cnt
        FROM public.messages WHERE created_at >= since
        GROUP BY 1 ORDER BY 1
      ) t
    ), '[]'),
    'revenue', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('d', day::date, 'n', total))
      FROM (
        SELECT date_trunc('day', completed_at) AS day, COALESCE(SUM(amount_xof), 0) AS total
        FROM public.payments WHERE status = 'completed' AND completed_at >= since
        GROUP BY 1 ORDER BY 1
      ) t
    ), '[]'),
    'departures', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('d', day::date, 'n', cnt))
      FROM (
        SELECT date_trunc('day', deleted_at) AS day, COUNT(*) AS cnt
        FROM public.account_deletions WHERE deleted_at >= since
        GROUP BY 1 ORDER BY 1
      ) t
    ), '[]'),
    'totals', jsonb_build_object(
      'members', v_total,
      'new_members', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since),
      'active_7d', (SELECT COUNT(*) FROM public.profiles WHERE last_seen >= now() - INTERVAL '7 days'),
      'active_30d', (SELECT COUNT(*) FROM public.profiles WHERE last_seen >= now() - INTERVAL '30 days'),
      'paying', (SELECT COUNT(*) FROM public.profiles WHERE premium_until > now()),
      'revenue_total', COALESCE((SELECT SUM(amount_xof) FROM public.payments WHERE status = 'completed'), 0),
      'revenue_period', COALESCE((SELECT SUM(amount_xof) FROM public.payments WHERE status = 'completed' AND completed_at >= since), 0),
      'orders_period', (SELECT COUNT(*) FROM public.payments WHERE status = 'completed' AND completed_at >= since),
      'pending', (SELECT COUNT(*) FROM public.payments WHERE status = 'pending'),
      'failed_period', (SELECT COUNT(*) FROM public.payments WHERE status = 'failed' AND created_at >= since)
    ),
    'croissance', jsonb_build_object(
      'inscriptions', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since),
      'departs', (SELECT COUNT(*) FROM public.account_deletions WHERE deleted_at >= since),
      'nette', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since) - (SELECT COUNT(*) FROM public.account_deletions WHERE deleted_at >= since),
      'departs_succes', (SELECT COUNT(*) FROM public.account_deletions WHERE deleted_at >= since AND reason = 'found_someone'),
      'suspendus', 0
    ),
    'engagement', jsonb_build_object(
      'likes', (SELECT COUNT(*) FROM public.swipes WHERE action = 'like' AND created_at >= since),
      'passes', (SELECT COUNT(*) FROM public.swipes WHERE action = 'pass' AND created_at >= since),
      'superlikes', (SELECT COUNT(*) FROM public.swipes WHERE action = 'super_like' AND created_at >= since),
      'publications', (SELECT COUNT(*) FROM public.community_posts WHERE created_at >= since),
      'visites', 0,
      'taux_reciprocite', NULL,
      'taux_engagement_match', NULL,
      'taux_reponse', NULL,
      'messages_par_match', NULL,
      'adhesion', NULL
    ),
    'experience', jsonb_build_object(
      'sans_like_recu', 0,
      'sans_match', 0,
      'sans_photo', (SELECT COUNT(*) FROM public.profiles WHERE photos IS NULL OR array_length(photos,1) = 0),
      'completion_moyenne', NULL
    ),
    'cohortes', '[]'::jsonb,
    'monetisation', jsonb_build_object(
      'panier_moyen', COALESCE((SELECT AVG(amount_xof) FROM public.payments WHERE status = 'completed'), 0),
      'payants_uniques', (SELECT COUNT(DISTINCT user_id) FROM public.payments WHERE status = 'completed'),
      'taux_conversion', CASE WHEN v_total > 0 THEN ROUND(((SELECT COUNT(DISTINCT user_id) FROM public.payments WHERE status='completed')::numeric / v_total) * 100, 1) ELSE 0 END,
      'taux_reachat', NULL,
      'jours_avant_achat', NULL,
      'revenu_abonnements', COALESCE((SELECT SUM(amount_xof) FROM public.payments WHERE status='completed'), 0),
      'echecs_periode', (SELECT COUNT(*) FROM public.payments WHERE status='failed' AND created_at >= since),
      'taux_echec', NULL
    ),
    'sante', jsonb_build_object(
      'signalements', (SELECT COUNT(*) FROM public.reports),
      'signalements_ouverts', (SELECT COUNT(*) FROM public.reports WHERE status = 'pending'),
      'blocages', (SELECT COUNT(*) FROM public.blocks),
      'tickets_ouverts', (SELECT COUNT(*) FROM public.support_tickets WHERE status = 'open'),
      'taux_signalement', NULL,
      'motifs', '{}'::jsonb
    ),
    'by_offer', '[]'::jsonb,
    'funnel', jsonb_build_object(
      'inscrits', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since),
      'ont_photo', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since AND array_length(photos,1) > 0),
      'ont_swipe', 0,
      'ont_match', 0,
      'ont_ecrit', 0,
      'ont_paye', (SELECT COUNT(DISTINCT user_id) FROM public.payments WHERE status='completed' AND created_at >= since)
    ),
    'by_country', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('k', country, 'n', cnt))
      FROM (SELECT country AS k, COUNT(*) AS cnt FROM public.profiles WHERE country IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10) t(country, cnt)
    ), '[]'),
    'by_gender', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('k', gender, 'n', cnt))
      FROM (SELECT gender AS k, COUNT(*) AS cnt FROM public.profiles WHERE gender IS NOT NULL GROUP BY 1) t(gender, cnt)
    ), '[]'),
    'by_age', '[]'::jsonb,
    'by_denomination', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('k', denomination, 'n', cnt))
      FROM (SELECT denomination AS k, COUNT(*) AS cnt FROM public.profiles WHERE denomination IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10) t(denomination, cnt)
    ), '[]')
  );
END;
$$;
