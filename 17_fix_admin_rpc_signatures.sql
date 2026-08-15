-- 17_fix_admin_rpc_signatures.sql
-- Corrige les fonctions RPC dont le format de retour ne correspond pas
-- au format attendu par le code React du dashboard admin.
-- À exécuter dans Supabase SQL Editor (Run and enable RLS).

-- ==============================================================================
-- 1. admin_analytics — Format complet attendu par admin.analytics.tsx
-- ==============================================================================
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
      'likes', (SELECT COUNT(*) FROM public.swipes WHERE liked = true AND created_at >= since),
      'passes', (SELECT COUNT(*) FROM public.swipes WHERE liked = false AND created_at >= since),
      'superlikes', 0,
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


-- ==============================================================================
-- 2. admin_team — Doit retourner {membres: [...]} attendu par admin.equipe.tsx
-- ==============================================================================
DROP FUNCTION IF EXISTS public.admin_team();

CREATE OR REPLACE FUNCTION public.admin_team()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  RETURN jsonb_build_object(
    'membres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sr.user_id,
        'nom', COALESCE(p.first_name, 'Inconnu'),
        'role', sr.role,
        'photo', CASE WHEN p.photos IS NOT NULL AND array_length(p.photos,1) > 0 THEN p.photos[1] ELSE NULL END,
        'created_at', sr.created_at,
        'last_seen', p.last_seen,
        'permissions', '[]'::jsonb,
        'consultations', 0
      ))
      FROM public.staff_roles sr
      JOIN public.profiles p ON sr.user_id = p.id
      ORDER BY sr.created_at DESC
    ), '[]')
  );
END;
$$;


-- ==============================================================================
-- 3. admin_support_stats — Format complet attendu par admin.support.tsx
-- ==============================================================================
DROP FUNCTION IF EXISTS public.admin_support_stats();

CREATE OR REPLACE FUNCTION public.admin_support_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  RETURN jsonb_build_object(
    'open', (SELECT COUNT(*) FROM public.support_tickets WHERE status = 'open'),
    'pending', (SELECT COUNT(*) FROM public.support_tickets WHERE status = 'pending'),
    'resolved', (SELECT COUNT(*) FROM public.support_tickets WHERE status = 'resolved'),
    'closed', (SELECT COUNT(*) FROM public.support_tickets WHERE status = 'closed'),
    'total', (SELECT COUNT(*) FROM public.support_tickets),
    'avg_first_reply_hours', NULL,
    'unanswered_over_24h', 0,
    'by_category', '{}'::jsonb
  );
END;
$$;


-- ==============================================================================
-- 4. admin_meta_ads — Format complet attendu par admin.meta-ads.tsx
-- ==============================================================================
DROP FUNCTION IF EXISTS public.admin_meta_ads(INT);

CREATE OR REPLACE FUNCTION public.admin_meta_ads(p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  since TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  RETURN jsonb_build_object(
    'periode_jours', p_days,
    'entonnoir', jsonb_build_object(
      'visites', 0,
      'inscrits', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since),
      'profils', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since AND array_length(photos,1) > 0),
      'matchs', (SELECT COUNT(*) FROM public.matches WHERE created_at >= since),
      'checkouts', (SELECT COUNT(*) FROM public.payments WHERE created_at >= since),
      'abonnes', (SELECT COUNT(DISTINCT user_id) FROM public.payments WHERE status = 'completed' AND created_at >= since),
      'revenus', COALESCE((SELECT SUM(amount_xof) FROM public.payments WHERE status = 'completed' AND completed_at >= since), 0)
    ),
    'campagnes', '[]'::jsonb,
    'evenements', '[]'::jsonb,
    'sante', jsonb_build_object(
      'envoyes_24h', 0,
      'reussis_24h', 0,
      'echecs_24h', 0,
      'dernier', NULL,
      'dernier_achat', (SELECT completed_at FROM public.payments WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1),
      'paiements_24h', (SELECT COUNT(*) FROM public.payments WHERE created_at >= now() - INTERVAL '24 hours'),
      'achats_24h', (SELECT COUNT(*) FROM public.payments WHERE status = 'completed' AND completed_at >= now() - INTERVAL '24 hours')
    ),
    'erreurs', '[]'::jsonb,
    'audiences', '{}'::jsonb,
    'sources', '[]'::jsonb
  );
END;
$$;


-- ==============================================================================
-- 5. admin_marketing — Format complet attendu par admin.marketing.tsx
-- ==============================================================================
DROP FUNCTION IF EXISTS public.admin_marketing(INT);

CREATE OR REPLACE FUNCTION public.admin_marketing(p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  since TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
  v_total INT;
  v_payants INT;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT COUNT(*) INTO v_total FROM public.profiles;
  SELECT COUNT(DISTINCT user_id) INTO v_payants FROM public.payments WHERE status = 'completed';
  RETURN jsonb_build_object(
    'periode_jours', p_days,
    'portee', jsonb_build_object(
      'membres', v_total,
      'email', v_total,
      'push', 0,
      'joignables', v_total,
      'taux', 100
    ),
    'acquisition', '[]'::jsonb,
    'entonnoir', jsonb_build_object(
      'inscrits', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since),
      'photo', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since AND array_length(photos,1) > 0),
      'swipe', (SELECT COUNT(DISTINCT user_id) FROM public.swipes WHERE created_at >= since),
      'match', (SELECT COUNT(DISTINCT user_id) FROM public.matches WHERE created_at >= since),
      'message', (SELECT COUNT(DISTINCT sender_id) FROM public.messages WHERE created_at >= since),
      'payant', (SELECT COUNT(DISTINCT user_id) FROM public.payments WHERE status = 'completed' AND created_at >= since)
    ),
    'segments', '[]'::jsonb,
    'campagnes', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.campaigns),
      'periode', (SELECT COUNT(*) FROM public.campaigns WHERE created_at >= since),
      'destinataires', 0,
      'delivres', 0,
      'ignores', 0
    ),
    'delivrabilite', jsonb_build_object(
      'supprimes', 0, 'rebonds', 0, 'plaintes', 0, 'envois_30j', 0, 'taux_plainte', 0
    ),
    'revenus', jsonb_build_object(
      'periode', COALESCE((SELECT SUM(amount_xof) FROM public.payments WHERE status='completed' AND completed_at >= since), 0),
      'total', COALESCE((SELECT SUM(amount_xof) FROM public.payments WHERE status='completed'), 0),
      'payants', v_payants,
      'panier', CASE WHEN v_payants > 0 THEN COALESCE((SELECT AVG(amount_xof) FROM public.payments WHERE status='completed'), 0) ELSE 0 END
    )
  );
END;
$$;


-- ==============================================================================
-- 6. admin_search_member — retourne les bons champs
-- ==============================================================================
DROP FUNCTION IF EXISTS public.admin_search_member(TEXT);

CREATE OR REPLACE FUNCTION public.admin_search_member(p_query TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nom', p.first_name,
      'is_verified', p.is_verified
    ))
    FROM public.profiles p
    WHERE p.first_name ILIKE '%' || p_query || '%'
    LIMIT 10
  ), '[]');
END;
$$;


-- ==============================================================================
-- 7. Colonne last_seen sur profiles si absente
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_seen') THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;
