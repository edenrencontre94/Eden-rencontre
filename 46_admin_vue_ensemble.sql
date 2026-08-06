-- ============================================================
-- /admin — vue d'ensemble réelle
-- ============================================================
-- CE QUI ÉTAIT FABRIQUÉ sur cette page, au-delà des graphiques déjà
-- corrigés :
--
--   • TOUTES les variations : « +14,5 % ce mois », « +8 vs hier »,
--     « +22,4 % vs semaine der. », « +30,1 % », « +42,5 % »… écrites en
--     dur, donc fausses par construction.
--
--   • Toutes les courbes miniatures : des tableaux figés dont seule la
--     dernière valeur était réelle. La courbe montait donc toujours.
--
--   • « Profils visités : 8.4K » et « Super Likes : 342 » — inventés de
--     bout en bout, alors que `profile_visits` et `swipes` contiennent
--     l'information exacte.
--
--   • Le fil « Activité en direct » : huit événements imaginaires, avec
--     des noms inventés et des montants qui ne correspondent même pas au
--     catalogue (« 24 990 FCFA », « 44 990 FCFA » — ces offres n'existent
--     pas).
--
--   • La rangée du bas : rétention 74 %, session 12 min, compatibilité
--     87 %, NPS +62. Aucune de ces quatre valeurs n'est mesurée nulle part.
--
-- Tout ce qui suit est calculé. Ce qui ne peut pas l'être a été retiré de
-- la page plutôt que simulé.

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now   timestamp with time zone := timezone('utc'::text, now());
  v_jour  timestamp with time zone := date_trunc('day', v_now);
  v_hier  timestamp with time zone := date_trunc('day', v_now) - interval '1 day';
  v_7j    timestamp with time zone := v_now - interval '7 days';
  v_14j   timestamp with time zone := v_now - interval '14 days';
  v_30j   timestamp with time zone := v_now - interval '30 days';
  v_60j   timestamp with time zone := v_now - interval '60 days';
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    -- ── Volumes bruts ──────────────────────────────────────
    'membres',   (SELECT count(*) FROM public.profiles),
    'matchs',    (SELECT count(*) FROM public.matches),
    'messages',  (SELECT count(*) FROM public.messages),
    'verifies',  (SELECT count(*) FROM public.profiles WHERE is_verified),
    'signalements_ouverts', (SELECT count(*) FROM public.reports WHERE status = 'pending'),

    -- ── Comparaisons de périodes ───────────────────────────
    -- Chaque variation compare une période à la PRÉCÉDENTE de même durée.
    -- C'est la seule comparaison honnête : opposer « ce mois » à « le mois
    -- dernier » sur des durées inégales gonfle ou écrase le résultat selon
    -- le jour où l'on regarde.
    'inscrits', jsonb_build_object(
      'jour',       (SELECT count(*) FROM public.profiles WHERE created_at >= v_jour),
      'hier',       (SELECT count(*) FROM public.profiles
                     WHERE created_at >= v_hier AND created_at < v_jour),
      'semaine',    (SELECT count(*) FROM public.profiles WHERE created_at >= v_7j),
      'semaine_p',  (SELECT count(*) FROM public.profiles
                     WHERE created_at >= v_14j AND created_at < v_7j),
      'mois',       (SELECT count(*) FROM public.profiles WHERE created_at >= v_30j),
      'mois_p',     (SELECT count(*) FROM public.profiles
                     WHERE created_at >= v_60j AND created_at < v_30j)
    ),

    'matchs_periode', jsonb_build_object(
      'mois',   (SELECT count(*) FROM public.matches WHERE created_at >= v_30j),
      'mois_p', (SELECT count(*) FROM public.matches
                 WHERE created_at >= v_60j AND created_at < v_30j)
    ),

    'messages_periode', jsonb_build_object(
      'mois',   (SELECT count(*) FROM public.messages WHERE created_at >= v_30j),
      'mois_p', (SELECT count(*) FROM public.messages
                 WHERE created_at >= v_60j AND created_at < v_30j)
    ),

    -- ── Chiffres du jour, réels ────────────────────────────
    'visites_jour',    (SELECT count(*) FROM public.profile_visits WHERE created_at >= v_jour),
    'visites_hier',    (SELECT count(*) FROM public.profile_visits
                        WHERE created_at >= v_hier AND created_at < v_jour),
    'superlikes_jour', (SELECT count(*) FROM public.swipes
                        WHERE action = 'superlike' AND created_at >= v_jour),
    'superlikes_hier', (SELECT count(*) FROM public.swipes
                        WHERE action = 'superlike'
                          AND created_at >= v_hier AND created_at < v_jour),

    -- ── Rétention à un mois ────────────────────────────────
    -- Parmi les membres inscrits il y a 30 à 60 jours, combien se sont
    -- connectés dans les 30 derniers jours. C'est mesurable ; le « NPS » et
    -- la « durée de session » affichés auparavant ne l'étaient pas, faute
    -- de tout instrument de mesure.
    'retention', (
      SELECT CASE WHEN count(*) = 0 THEN NULL
             ELSE ROUND(
               (count(*) FILTER (WHERE last_seen >= v_30j)::numeric / count(*)) * 100, 0)
             END
      FROM public.profiles
      WHERE created_at >= v_60j AND created_at < v_30j
    ),
    'retention_base', (
      SELECT count(*) FROM public.profiles
      WHERE created_at >= v_60j AND created_at < v_30j
    ),

    -- ── Fil d'activité, tiré des tables ────────────────────
    -- Le tri et la troncature se font sur une colonne TYPÉE, avant
    -- l'agrégation : `LIMIT` après `jsonb_agg` ne limiterait rien, l'agrégat
    -- ne produisant qu'une seule ligne.
    'activite', (
      SELECT COALESCE(jsonb_agg(
               jsonb_build_object('type', d.type, 'texte', d.texte,
                                  'detail', d.detail, 'at', d.at)
               ORDER BY d.at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM (
          (SELECT 'membre' AS type, 'Nouveau membre inscrit' AS texte,
                  COALESCE(p.first_name, 'Membre') || COALESCE(', ' || p.city, '') AS detail,
                  p.created_at AS at
           FROM public.profiles p ORDER BY p.created_at DESC LIMIT 10)

          UNION ALL
          (SELECT 'match', 'Nouveau match',
                  COALESCE(a.first_name, '?') || ' & ' || COALESCE(b.first_name, '?'),
                  m.created_at
           FROM public.matches m
           LEFT JOIN public.profiles a ON a.id = m.user1_id
           LEFT JOIN public.profiles b ON b.id = m.user2_id
           ORDER BY m.created_at DESC LIMIT 10)

          UNION ALL
          (SELECT 'paiement', 'Paiement encaissé',
                  COALESCE(pr.first_name, 'Membre') || ' — ' || pay.offer_id
                  || ' · ' || pay.amount_xof || ' FCFA',
                  pay.completed_at
           FROM public.payments pay
           LEFT JOIN public.profiles pr ON pr.id = pay.user_id
           WHERE pay.status = 'completed' AND pay.completed_at IS NOT NULL
           ORDER BY pay.completed_at DESC LIMIT 10)

          UNION ALL
          (SELECT 'signalement', 'Signalement ouvert',
                  COALESCE(pr.first_name, 'Membre') || ' — ' || COALESCE(r.reason, 'sans motif'),
                  r.created_at
           FROM public.reports r
           LEFT JOIN public.profiles pr ON pr.id = r.reported_id
           ORDER BY r.created_at DESC LIMIT 10)

          UNION ALL
          (SELECT 'support', 'Demande de support', t.subject, t.created_at
           FROM public.support_tickets t
           ORDER BY t.created_at DESC LIMIT 10)
        ) tous
        WHERE at IS NOT NULL
        ORDER BY at DESC
        LIMIT 12
      ) d
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
SELECT public.admin_overview() AS vue_ensemble;
