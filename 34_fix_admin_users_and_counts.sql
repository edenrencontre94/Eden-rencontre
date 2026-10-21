-- ==============================================================================
-- 34_fix_admin_users_and_counts.sql
-- Correction définitive des RPC pour /admin/utilisateurs
-- ==============================================================================

-- ─── 1. S'assurer des colonnes dans public.profiles ───────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_plan TEXT DEFAULT 'gratuit';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'tous';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;

-- ─── 2. admin_plan_counts ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_plan_counts();

CREATE OR REPLACE FUNCTION public.admin_plan_counts()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT (SELECT public.is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT json_build_object(
    'total', COUNT(*),
    'gratuit', COUNT(*) FILTER (WHERE public_plan = 'gratuit' OR public_plan = 'free' OR public_plan IS NULL),
    'premium', COUNT(*) FILTER (WHERE (public_plan = 'premium' AND (premium_until IS NULL OR premium_until > now())) OR is_founder),
    'fondateurs', COUNT(*) FILTER (WHERE is_founder),
    'expires', COUNT(*) FILTER (WHERE public_plan = 'premium' AND premium_until IS NOT NULL AND premium_until <= now()),
    'nouveaux_7j', COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'femmes', COUNT(*) FILTER (WHERE LOWER(gender) IN ('female', 'femme', 'f')),
    'hommes', COUNT(*) FILTER (WHERE LOWER(gender) IN ('male', 'homme', 'h')),
    'genre_absent', COUNT(*) FILTER (WHERE gender IS NULL OR LOWER(gender) NOT IN ('female', 'femme', 'f', 'male', 'homme', 'h')),
    'actifs_7j', COUNT(*) FILTER (WHERE last_seen >= now() - interval '7 days'),
    'actifs_30j', COUNT(*) FILTER (WHERE last_seen >= now() - interval '30 days'),
    'verifies', COUNT(*) FILTER (WHERE is_verified),
    'non_verifies', COUNT(*) FILTER (WHERE NOT COALESCE(is_verified, false)),
    'payants', COALESCE((SELECT COUNT(DISTINCT user_id) FROM public.payments WHERE status = 'completed'), 0),
    'ca_total', COALESCE((SELECT SUM(amount_xof) FROM public.payments WHERE status = 'completed'), 0),
    'revenu_par_payant', 0,
    'taux_conversion', 0,
    'expire_7j', COUNT(*) FILTER (WHERE premium_until BETWEEN now() AND now() + interval '7 days'),
    'inactifs_30j', COUNT(*) FILTER (WHERE last_seen < now() - interval '30 days' OR last_seen IS NULL),
    'signales', COALESCE((SELECT COUNT(DISTINCT reported_id) FROM public.reports WHERE status = 'pending'), 0),
    'en_pause', COUNT(*) FILTER (WHERE visibility = 'pause'),
    'suspendus', COUNT(*) FILTER (WHERE suspended_until > now())
  ) INTO result
  FROM public.profiles;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_plan_counts() TO authenticated;


-- ─── 3. admin_users_by_plan ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_users_by_plan(TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_users_by_plan(TEXT, INT, INT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_users_by_plan(
  p_plan TEXT DEFAULT 'all',
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_segment TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_verified BOOLEAN DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT (SELECT public.is_staff()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) INTO result
  FROM (
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.city,
      p.country,
      p.gender,
      COALESCE(p.is_verified, false) as is_verified,
      COALESCE(p.is_founder, false) as is_founder,
      COALESCE(p.public_plan, 'gratuit') as public_plan,
      p.premium_until,
      p.created_at,
      p.last_seen,
      p.photos,
      p.denomination,
      COALESCE(p.visibility, 'tous') as visibility,
      
      -- Stats financières
      COALESCE((SELECT SUM(amount_xof) FROM public.payments pay WHERE pay.user_id = p.id AND pay.status = 'completed'), 0) as total_paye,
      COALESCE((SELECT COUNT(*) FROM public.payments pay WHERE pay.user_id = p.id AND pay.status = 'completed'), 0) as nb_paiements,
      (SELECT pay.created_at FROM public.payments pay WHERE pay.user_id = p.id AND pay.status = 'completed' ORDER BY pay.created_at DESC LIMIT 1) as dernier_paiement,
      (SELECT pay.plan FROM public.payments pay WHERE pay.user_id = p.id AND pay.status = 'completed' ORDER BY pay.created_at DESC LIMIT 1) as derniere_offre,
      
      -- Completion indicative (évite l'erreur de colonne p.completion manquante)
      CASE WHEN p.bio IS NOT NULL AND length(trim(p.bio)) > 10 THEN 80 ELSE 50 END as completion,

      COALESCE((SELECT COUNT(*) FROM public.matches m WHERE m.user1_id = p.id OR m.user2_id = p.id), 0) as nb_matchs,
      COALESCE((SELECT COUNT(*) FROM public.messages msg WHERE msg.sender_id = p.id), 0) as nb_messages,
      COALESCE((SELECT COUNT(*) FROM public.swipes sw WHERE sw.actor_id = p.id AND sw.action = 'like'), 0) as nb_likes_donnes,
      COALESCE((SELECT COUNT(*) FROM public.swipes sw WHERE sw.target_id = p.id AND sw.action = 'like'), 0) as nb_likes_recus,
      COALESCE((SELECT COUNT(*) FROM public.reports rep WHERE rep.reported_id = p.id), 0) as nb_signalements,
      COALESCE((SELECT COUNT(*) FROM public.blocked_users blk WHERE blk.blocked_id = p.id), 0) as nb_blocages,
      COALESCE((SELECT COUNT(*) FROM public.support_tickets st WHERE st.user_id = p.id), 0) as nb_tickets,
      
      p.suspended_until,
      p.suspension_reason,
      COUNT(*) OVER() as total_count
    FROM public.profiles p
    WHERE 
      -- Filtre Plan
      (p_plan IS NULL OR p_plan = 'all' OR 
       (p_plan = 'gratuit' AND (p.public_plan = 'gratuit' OR p.public_plan IS NULL OR p.public_plan = 'free')) OR 
       (p_plan = 'premium' AND (p.public_plan = 'premium' OR p.is_founder))
      )
      -- Filtre Search
      AND (p_search IS NULL OR p_search = '' OR 
           p.first_name ILIKE '%' || p_search || '%' OR 
           p.last_name ILIKE '%' || p_search || '%' OR
           p.city ILIKE '%' || p_search || '%' OR
           p.country ILIKE '%' || p_search || '%')
      -- Filtre Segment
      AND (p_segment IS NULL OR p_segment = '' OR 
           (p_segment = 'inactifs' AND (p.last_seen < now() - interval '30 days' OR p.last_seen IS NULL)) OR
           (p_segment = 'expire_bientot' AND p.premium_until BETWEEN now() AND now() + interval '7 days') OR
           (p_segment = 'en_pause' AND p.visibility = 'pause') OR
           (p_segment = 'suspendus' AND p.suspended_until > now())
          )
      -- Filtres supplémentaires
      AND (
        p_gender IS NULL OR p_gender = '' OR
        (LOWER(p_gender) IN ('female', 'femme', 'f') AND LOWER(p.gender) IN ('female', 'femme', 'f')) OR
        (LOWER(p_gender) IN ('male', 'homme', 'h') AND LOWER(p.gender) IN ('male', 'homme', 'h')) OR
        LOWER(p.gender) = LOWER(p_gender)
      )
      AND (p_country IS NULL OR p_country = '' OR p.country ILIKE '%' || p_country || '%')
      AND (p_verified IS NULL OR p.is_verified = p_verified)
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_users_by_plan(TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
