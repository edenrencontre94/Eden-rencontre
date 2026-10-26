-- ==============================================================================
-- 38_fix_admin_user_detail.sql
-- Correction de la fonction RPC admin_user_detail pour retourner la structure complète
-- attendue par la fiche utilisateur dans /admin/utilisateurs (UserDetailSheet).
-- ==============================================================================

DROP FUNCTION IF EXISTS public.admin_user_detail(UUID);

CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profil JSON;
  v_paiements JSON;
  v_activite JSON;
  v_moderation JSON;
  v_support JSON;
  v_gestes JSON;
  v_result JSON;
BEGIN
  -- 1. Contrôle des droits staff
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- 2. Profil utilisateur
  SELECT row_to_json(p) INTO v_profil
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_profil IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3. Historique des paiements
  BEGIN
    SELECT COALESCE(json_agg(row_to_json(pay) ORDER BY pay.created_at DESC), '[]'::json) INTO v_paiements
    FROM (
      SELECT * FROM public.payments WHERE user_id = p_user_id LIMIT 50
    ) pay;
  EXCEPTION WHEN OTHERS THEN
    v_paiements := '[]'::json;
  END;

  -- 4. Activité (matchs, messages, likes, swipes, publications)
  DECLARE
    v_matchs INT := 0;
    v_messages INT := 0;
    v_likes_donnes INT := 0;
    v_likes_recus INT := 0;
    v_passes INT := 0;
    v_publications INT := 0;
    v_visites INT := 0;
  BEGIN
    -- Matchs
    BEGIN
      SELECT COUNT(*) INTO v_matchs FROM public.matches WHERE user1_id = p_user_id OR user2_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN v_matchs := 0; END;

    -- Messages envoyés
    BEGIN
      SELECT COUNT(*) INTO v_messages FROM public.messages WHERE sender_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN v_messages := 0; END;

    -- Likes donnés / swipes
    BEGIN
      SELECT 
        COUNT(*) FILTER (WHERE direction = 'right'),
        COUNT(*) FILTER (WHERE direction = 'left')
      INTO v_likes_donnes, v_passes
      FROM public.swipes WHERE swiper_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN 
      v_likes_donnes := 0;
      v_passes := 0;
    END;

    -- Likes reçus
    BEGIN
      SELECT COUNT(*) INTO v_likes_recus FROM public.swipes WHERE swiped_id = p_user_id AND direction = 'right';
    EXCEPTION WHEN OTHERS THEN v_likes_recus := 0; END;

    -- Publications
    BEGIN
      SELECT COUNT(*) INTO v_publications FROM public.community_posts WHERE user_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN v_publications := 0; END;

    -- Visites reçues
    BEGIN
      SELECT COUNT(*) INTO v_visites FROM public.profile_visits WHERE visited_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN v_visites := 0; END;

    v_activite := json_build_object(
      'matchs', COALESCE(v_matchs, 0),
      'messages_envoyes', COALESCE(v_messages, 0),
      'likes_donnes', COALESCE(v_likes_donnes, 0),
      'likes_recus', COALESCE(v_likes_recus, 0),
      'passes', COALESCE(v_passes, 0),
      'swipes_total', COALESCE(v_likes_donnes, 0) + COALESCE(v_passes, 0),
      'publications', COALESCE(v_publications, 0),
      'visites_recues', COALESCE(v_visites, 0),
      'boosts', 0
    );
  END;

  -- 5. Modération (signalements reçus, émis, blocages)
  DECLARE
    v_recus JSON := '[]'::json;
    v_emis_n INT := 0;
    v_bloque_par_n INT := 0;
    v_a_bloque_n INT := 0;
  BEGIN
    -- Signalements reçus
    BEGIN
      SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::json) INTO v_recus
      FROM (
        SELECT id, reporter_id, reason, details, status, created_at
        FROM public.reports
        WHERE reported_id = p_user_id
        LIMIT 50
      ) r;
    EXCEPTION WHEN OTHERS THEN v_recus := '[]'::json; END;

    -- Signalements émis
    BEGIN
      SELECT COUNT(*) INTO v_emis_n FROM public.reports WHERE reporter_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN v_emis_n := 0; END;

    -- Blocages
    BEGIN
      SELECT COUNT(*) INTO v_bloque_par_n FROM public.blocks WHERE blocked_id = p_user_id;
      SELECT COUNT(*) INTO v_a_bloque_n FROM public.blocks WHERE blocker_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN 
      v_bloque_par_n := 0;
      v_a_bloque_n := 0;
    END;

    v_moderation := json_build_object(
      'recus', COALESCE(v_recus, '[]'::json),
      'emis_n', COALESCE(v_emis_n, 0),
      'bloque_par_n', COALESCE(v_bloque_par_n, 0),
      'a_bloque_n', COALESCE(v_a_bloque_n, 0)
    );
  END;

  -- 6. Support tickets
  BEGIN
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::json) INTO v_support
    FROM (
      SELECT id, user_id, subject, status, category, created_at
      FROM public.support_tickets
      WHERE user_id = p_user_id
      LIMIT 20
    ) t;
  EXCEPTION WHEN OTHERS THEN
    v_support := '[]'::json;
  END;

  -- 7. Gestes commerciaux / logs
  BEGIN
    SELECT COALESCE(json_agg(row_to_json(g) ORDER BY g.created_at DESC), '[]'::json) INTO v_gestes
    FROM (
      SELECT al.created_at, al.motif as reason, 
             COALESCE((regexp_matches(al.motif, '(\d+)\s*j'))[1]::INT, 7) as days
      FROM public.admin_access_log al
      WHERE al.target_id = p_user_id::TEXT AND al.action = 'grant_days'
      LIMIT 20
    ) g;
  EXCEPTION WHEN OTHERS THEN
    v_gestes := '[]'::json;
  END;

  -- 8. Assemblage final
  v_result := json_build_object(
    'profil', v_profil,
    'paiements', COALESCE(v_paiements, '[]'::json),
    'activite', v_activite,
    'moderation', v_moderation,
    'support', COALESCE(v_support, '[]'::json),
    'gestes', COALESCE(v_gestes, '[]'::json)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_detail(UUID) TO authenticated;
