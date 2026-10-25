-- ==============================================================================
-- 35_fix_admin_overview_activity.sql
-- Correction de la fonction admin_overview() pour agréger les vraies activités
-- récentes (Inscriptions, Matchs, Paiements, Signalements, Tickets Support)
-- ainsi que les visites du jour et les Super Likes réels.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.admin_overview();

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_today TIMESTAMPTZ := date_trunc('day', v_now);
  v_yesterday TIMESTAMPTZ := v_today - INTERVAL '1 day';
  v_week TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_week_p TIMESTAMPTZ := v_now - INTERVAL '14 days';
  v_month TIMESTAMPTZ := v_now - INTERVAL '30 days';
  v_month_p TIMESTAMPTZ := v_now - INTERVAL '60 days';

  v_insc_jour INT; v_insc_hier INT;
  v_insc_semaine INT; v_insc_semaine_p INT;
  v_insc_mois INT; v_insc_mois_p INT;
  
  v_matchs_mois INT; v_matchs_mois_p INT;
  v_msgs_mois INT; v_msgs_mois_p INT;

  v_visites_jour INT := 0;
  v_visites_hier INT := 0;

  v_superlikes_jour INT := 0;
  v_superlikes_hier INT := 0;

  v_activites JSONB := '[]'::jsonb;
  v_retention INT := 0;
  v_retention_base INT := 0;
BEGIN
  IF NOT public.is_staff() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- 1. Inscriptions
  SELECT COUNT(*) INTO v_insc_jour FROM public.profiles WHERE created_at >= v_today;
  SELECT COUNT(*) INTO v_insc_hier FROM public.profiles WHERE created_at >= v_yesterday AND created_at < v_today;
  SELECT COUNT(*) INTO v_insc_semaine FROM public.profiles WHERE created_at >= v_week;
  SELECT COUNT(*) INTO v_insc_semaine_p FROM public.profiles WHERE created_at >= v_week_p AND created_at < v_week;
  SELECT COUNT(*) INTO v_insc_mois FROM public.profiles WHERE created_at >= v_month;
  SELECT COUNT(*) INTO v_insc_mois_p FROM public.profiles WHERE created_at >= v_month_p AND created_at < v_month;

  -- 2. Matchs & Messages
  SELECT COUNT(*) INTO v_matchs_mois FROM public.matches WHERE created_at >= v_month;
  SELECT COUNT(*) INTO v_matchs_mois_p FROM public.matches WHERE created_at >= v_month_p AND created_at < v_month;

  SELECT COUNT(*) INTO v_msgs_mois FROM public.messages WHERE created_at >= v_month;
  SELECT COUNT(*) INTO v_msgs_mois_p FROM public.messages WHERE created_at >= v_month_p AND created_at < v_month;

  -- 3. Visites de profil (si la table existe)
  BEGIN
    SELECT COUNT(*) INTO v_visites_jour FROM public.profile_visits WHERE created_at >= v_today;
    SELECT COUNT(*) INTO v_visites_hier FROM public.profile_visits WHERE created_at >= v_yesterday AND created_at < v_today;
  EXCEPTION WHEN OTHERS THEN
    v_visites_jour := 0;
    v_visites_hier := 0;
  END;

  -- 4. Super Likes (swipes avec action = 'superlike' ou 'super_like')
  BEGIN
    SELECT COUNT(*) INTO v_superlikes_jour FROM public.swipes WHERE action IN ('superlike', 'super_like') AND created_at >= v_today;
    SELECT COUNT(*) INTO v_superlikes_hier FROM public.swipes WHERE action IN ('superlike', 'super_like') AND created_at >= v_yesterday AND created_at < v_today;
  EXCEPTION WHEN OTHERS THEN
    v_superlikes_jour := 0;
    v_superlikes_hier := 0;
  END;

  -- 5. Rétention M1 (inscrits il y a 30 à 60 jours qui se sont connectés dans les 30 derniers jours)
  BEGIN
    SELECT COUNT(*) INTO v_retention_base
    FROM public.profiles
    WHERE created_at >= v_month_p AND created_at < v_month;

    IF v_retention_base > 0 THEN
      SELECT ROUND((COUNT(*)::numeric / v_retention_base::numeric) * 100) INTO v_retention
      FROM public.profiles
      WHERE created_at >= v_month_p AND created_at < v_month
        AND last_seen >= v_month;
    ELSE
      v_retention := 0;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_retention := 0;
    v_retention_base := 0;
  END;

  -- 6. Activités récentes agrégées (Top 12 des derniers événements)
  BEGIN
    WITH events AS (
      -- Inscriptions
      (
        SELECT 
          'inscription' AS type,
          'Nouvel inscrit : ' || COALESCE(NULLIF(TRIM(p.first_name), ''), 'Un membre') AS texte,
          COALESCE(p.city, p.country, 'Localisation non précisée') AS detail,
          p.created_at AS at
        FROM public.profiles p
        WHERE p.created_at IS NOT NULL
        ORDER BY p.created_at DESC
        LIMIT 6
      )
      UNION ALL
      -- Matchs
      (
        SELECT
          'match' AS type,
          'Nouveau match créé' AS texte,
          COALESCE(p1.first_name, 'Membre') || ' & ' || COALESCE(p2.first_name, 'Membre') AS detail,
          m.created_at AS at
        FROM public.matches m
        LEFT JOIN public.profiles p1 ON p1.id = m.user1_id
        LEFT JOIN public.profiles p2 ON p2.id = m.user2_id
        WHERE m.created_at IS NOT NULL
        ORDER BY m.created_at DESC
        LIMIT 6
      )
      UNION ALL
      -- Paiements
      (
        SELECT
          'paiement' AS type,
          'Paiement validé (' || pay.amount_xof || ' FCFA)' AS texte,
          COALESCE(p.first_name, 'Membre') || ' — ' || COALESCE(pay.plan_id, 'Abonnement') AS detail,
          COALESCE(pay.completed_at, pay.created_at) AS at
        FROM public.payments pay
        LEFT JOIN public.profiles p ON p.id = pay.user_id
        WHERE pay.status = 'completed'
        ORDER BY COALESCE(pay.completed_at, pay.created_at) DESC
        LIMIT 6
      )
      UNION ALL
      -- Signalements
      (
        SELECT
          'signalement' AS type,
          'Nouveau signalement' AS texte,
          'Motif : ' || COALESCE(r.reason, 'Non spécifié') AS detail,
          r.created_at AS at
        FROM public.reports r
        ORDER BY r.created_at DESC
        LIMIT 6
      )
      UNION ALL
      -- Demandes de support
      (
        SELECT
          'support' AS type,
          'Ticket support ouvert' AS texte,
          COALESCE(t.subject, 'Demande d''aide') AS detail,
          t.created_at AS at
        FROM public.support_tickets t
        ORDER BY t.created_at DESC
        LIMIT 6
      )
    )
    SELECT COALESCE(jsonb_agg(row_to_json(e)), '[]'::jsonb)
    INTO v_activites
    FROM (
      SELECT type, texte, detail, at
      FROM events
      ORDER BY at DESC
      LIMIT 12
    ) e;
  EXCEPTION WHEN OTHERS THEN
    v_activites := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'inscrits', jsonb_build_object(
      'jour', v_insc_jour, 'hier', v_insc_hier,
      'semaine', v_insc_semaine, 'semaine_p', v_insc_semaine_p,
      'mois', v_insc_mois, 'mois_p', v_insc_mois_p
    ),
    'matchs_periode', jsonb_build_object('mois', v_matchs_mois, 'mois_p', v_matchs_mois_p),
    'messages_periode', jsonb_build_object('mois', v_msgs_mois, 'mois_p', v_msgs_mois_p),
    'visites_jour', v_visites_jour,
    'visites_hier', v_visites_hier,
    'superlikes_jour', v_superlikes_jour,
    'superlikes_hier', v_superlikes_hier,
    'activite', v_activites,
    'retention', v_retention,
    'retention_base', v_retention_base
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;
