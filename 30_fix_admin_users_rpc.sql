-- ==============================================================================
-- 30_fix_admin_users_rpc.sql
-- Met à jour les RPC admin_plan_counts et admin_users_by_plan pour qu'elles
-- retournent et acceptent exactement ce que le composant React attend.
-- ==============================================================================

-- ─── 1. admin_plan_counts ────────────────────────────────────────────────────
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
    'premium', COUNT(*) FILTER (WHERE public_plan = 'premium' AND (premium_until IS NULL OR premium_until > now()) OR is_founder),
    'fondateurs', COUNT(*) FILTER (WHERE is_founder),
    'expires', COUNT(*) FILTER (WHERE public_plan = 'premium' AND premium_until IS NOT NULL AND premium_until <= now()),
    'nouveaux_7j', COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'femmes', COUNT(*) FILTER (WHERE gender = 'female'),
    'hommes', COUNT(*) FILTER (WHERE gender = 'male'),
    'genre_absent', COUNT(*) FILTER (WHERE gender IS NULL OR (gender != 'female' AND gender != 'male')),
    'actifs_7j', COUNT(*) FILTER (WHERE last_seen >= now() - interval '7 days'),
    'actifs_30j', COUNT(*) FILTER (WHERE last_seen >= now() - interval '30 days'),
    'verifies', COUNT(*) FILTER (WHERE is_verified),
    'non_verifies', COUNT(*) FILTER (WHERE NOT COALESCE(is_verified, false)),
    'payants', 0, -- On simule pour l'instant si on n'a pas accès à la table payments
    'ca_total', 0,
    'revenu_par_payant', 0,
    'taux_conversion', 0,
    'expire_7j', COUNT(*) FILTER (WHERE premium_until BETWEEN now() AND now() + interval '7 days'),
    'inactifs_30j', COUNT(*) FILTER (WHERE last_seen < now() - interval '30 days' OR last_seen IS NULL),
    'signales', 0, -- Remplacer par des COUNT JOIN si nécessaire
    'en_pause', COUNT(*) FILTER (WHERE visibility = 'pause'),
    'suspendus', COUNT(*) FILTER (WHERE suspended_until > now() OR suspended_until = 'infinity')
  ) INTO result
  FROM public.profiles;

  RETURN result;
END;
$$;


-- ─── 2. admin_users_by_plan ─────────────────────────────────────────────────
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
      
      -- Stats factices ou par défaut (à relier aux vraies tables si dispo)
      0 as total_paye,
      0 as nb_paiements,
      NULL as dernier_paiement,
      NULL as derniere_offre,
      COALESCE(p.completion, 0) as completion,
      0 as nb_matchs,
      0 as nb_messages,
      0 as nb_likes_donnes,
      0 as nb_likes_recus,
      0 as nb_signalements,
      0 as nb_blocages,
      0 as nb_tickets,
      
      p.suspended_until,
      p.suspension_reason,
      COUNT(*) OVER() as total_count
    FROM public.profiles p
    WHERE 
      -- Filtre Plan
      (p_plan = 'all' OR 
       (p_plan = 'gratuit' AND (p.public_plan = 'gratuit' OR p.public_plan IS NULL OR p.public_plan = 'free')) OR 
       (p_plan = 'premium' AND (p.public_plan = 'premium' OR p.is_founder))
      )
      -- Filtre Search
      AND (p_search IS NULL OR p_search = '' OR 
           p.first_name ILIKE '%' || p_search || '%' OR 
           p.last_name ILIKE '%' || p_search || '%')
      -- Filtre Segment
      AND (p_segment IS NULL OR p_segment = '' OR 
           (p_segment = 'inactifs' AND (p.last_seen < now() - interval '30 days' OR p.last_seen IS NULL)) OR
           (p_segment = 'incomplet' AND p.completion < 50) OR
           (p_segment = 'expire_bientot' AND p.premium_until BETWEEN now() AND now() + interval '7 days') OR
           (p_segment = 'en_pause' AND p.visibility = 'pause') OR
           (p_segment = 'suspendus' AND p.suspended_until > now())
          )
      -- Filtres supplémentaires
      AND (p_gender IS NULL OR p_gender = '' OR p.gender = p_gender)
      AND (p_country IS NULL OR p_country = '' OR p.country ILIKE '%' || p_country || '%')
      AND (p_verified IS NULL OR p.is_verified = p_verified)
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
