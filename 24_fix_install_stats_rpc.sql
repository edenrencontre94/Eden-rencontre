-- Corrige la fonction admin_install_stats qui renvoyait une mauvaise structure JSON
CREATE OR REPLACE FUNCTION public.admin_install_stats(p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_since TIMESTAMP WITH TIME ZONE := now() - (p_days || ' days')::interval;
  v_total INT;
  v_periode INT;
  v_actifs INT;
  v_actifs_installes INT;
  v_msg_installes INT := 0;
  v_msg_non_installes INT := 0;
  v_installes_n INT := 0;
  v_non_installes_n INT := 0;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Access denied'; END IF;

  -- 1. Total des installations (ceux qui ont un endpoint push)
  SELECT COUNT(DISTINCT user_id) INTO v_total FROM public.push_subscriptions;
  
  -- 2. Installations récentes
  SELECT COUNT(DISTINCT user_id) INTO v_periode FROM public.push_subscriptions WHERE created_at >= v_since;

  -- 3. Actifs récents
  SELECT COUNT(*) INTO v_actifs FROM public.profiles WHERE last_seen >= v_since;

  -- 4. Actifs qui ont installé l'app
  SELECT COUNT(DISTINCT p.id) INTO v_actifs_installes
  FROM public.profiles p
  JOIN public.push_subscriptions sub ON sub.user_id = p.id
  WHERE p.last_seen >= v_since;

  -- 5. Engagement (Messages envoyés)
  -- Utilisateurs avec app installée
  SELECT COUNT(DISTINCT id) INTO v_installes_n FROM public.profiles WHERE id IN (SELECT user_id FROM public.push_subscriptions);
  -- Utilisateurs sans app
  SELECT COUNT(DISTINCT id) INTO v_non_installes_n FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.push_subscriptions);
  
  -- Messages des utilisateurs avec app (sur la période)
  SELECT COUNT(*) INTO v_msg_installes 
  FROM public.messages m 
  WHERE m.created_at >= v_since 
  AND m.sender_id IN (SELECT user_id FROM public.push_subscriptions);

  -- Messages des utilisateurs sans app (sur la période)
  SELECT COUNT(*) INTO v_msg_non_installes 
  FROM public.messages m 
  WHERE m.created_at >= v_since 
  AND m.sender_id NOT IN (SELECT user_id FROM public.push_subscriptions);

  RETURN jsonb_build_object(
    'total', v_total,
    'periode', v_periode,
    'vivantes', v_actifs_installes,
    'actifs', v_actifs,
    'actifs_installes', v_actifs_installes,
    'part_actifs', CASE WHEN v_actifs > 0 THEN ROUND((v_actifs_installes::numeric / v_actifs::numeric) * 100) ELSE 0 END,
    'par_plateforme', '[]'::jsonb,
    'courbe', '[]'::jsonb,
    'engagement', jsonb_build_object(
      'installes_n', v_installes_n,
      'non_installes_n', v_non_installes_n,
      'msg_installes', v_msg_installes,
      'msg_non_installes', v_msg_non_installes
    ),
    'push', jsonb_build_object(
      'installes', v_total,
      'non_installes', CASE WHEN v_actifs > v_total THEN v_actifs - v_total ELSE 0 END,
      'part_installes', CASE WHEN v_actifs > 0 THEN ROUND((v_total::numeric / v_actifs::numeric) * 100) ELSE 0 END
    )
  );
END;
$$;
