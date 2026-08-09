-- ============================================================
-- Suivi des installations (PWA)
-- ============================================================
-- L'application détectait déjà, côté navigateur, si elle tournait en
-- mode installé — mais uniquement pour masquer les invitations. Rien
-- n'était jamais enregistré : impossible de savoir combien de membres
-- avaient franchi le pas.
--
-- CE QUI EST MESURABLE
--   • Android : l'évènement `appinstalled`, à la seconde près.
--   • iPhone : Safari ne l'émet pas. On l'apprend à la première
--     ouverture depuis l'icône, donc avec un décalage assumé.
--   • Chaque ouverture en mode installé, quelle que soit la plateforme.
--
-- CE QUI NE L'EST PAS
--   • Les désinstallations : aucun navigateur ne les signale. On ne
--     peut que déduire d'une absence prolongée.

-- ------------------------------------------------------------
-- 1. Une ligne par membre et par plateforme
-- ------------------------------------------------------------
-- Un même membre peut installer sur son téléphone ET son ordinateur :
-- la clé porte donc sur le couple, pas sur le seul membre.
CREATE TABLE IF NOT EXISTS public.app_installs (
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 'android' | 'ios' | 'desktop' | 'autre'
  platform     text NOT NULL,
  -- 'evenement' : capté à l'instant de l'installation (Android)
  -- 'ouverture' : déduit d'un lancement depuis l'écran d'accueil
  source       text NOT NULL DEFAULT 'ouverture',
  installed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Dernier lancement constaté en mode installé. C'est LUI qui distingue
  -- une installation vivante d'une icône oubliée.
  last_seen    timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_agent   text,
  PRIMARY KEY (user_id, platform)
);

CREATE INDEX IF NOT EXISTS app_installs_date_idx
  ON public.app_installs (installed_at DESC);

ALTER TABLE public.app_installs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chacun voit ses installations" ON public.app_installs;
CREATE POLICY "Chacun voit ses installations"
ON public.app_installs FOR SELECT
TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. Signalement depuis le navigateur
-- ------------------------------------------------------------
-- Appelée à chaque démarrage en mode installé, et à l'évènement
-- `appinstalled`. Idempotente : elle crée la ligne au premier appel,
-- puis ne fait plus que rafraîchir `last_seen`.
CREATE OR REPLACE FUNCTION public.signaler_installation(
  p_platform   text,
  p_source     text DEFAULT 'ouverture',
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  -- Liste blanche : la valeur vient du navigateur, donc de l'utilisateur.
  -- Sans ce filtre, n'importe quoi finirait dans les statistiques.
  IF p_platform NOT IN ('android', 'ios', 'desktop', 'autre') THEN
    p_platform := 'autre';
  END IF;
  IF p_source NOT IN ('evenement', 'ouverture') THEN
    p_source := 'ouverture';
  END IF;

  INSERT INTO public.app_installs (user_id, platform, source, user_agent)
  VALUES (auth.uid(), p_platform, p_source, left(COALESCE(p_user_agent, ''), 300))
  ON CONFLICT (user_id, platform) DO UPDATE
    SET last_seen = timezone('utc'::text, now()),
        -- `installed_at` n'est JAMAIS réécrit : la date de première
        -- installation est ce qu'on veut mesurer.
        --
        -- La source, en revanche, se corrige : une installation d'abord
        -- déduite d'une ouverture devient 'evenement' si le navigateur
        -- finit par nous le confirmer.
        source = CASE
          WHEN EXCLUDED.source = 'evenement' THEN 'evenement'
          ELSE app_installs.source
        END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.signaler_installation(text, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 3. Statistiques pour le tableau de bord
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_install_stats(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deb          timestamp with time zone;
  v_total        integer;
  v_periode      integer;
  v_actifs       integer;
  v_actifs_inst  integer;
  v_vivantes     integer;
  v_push_inst    integer;
  v_push_non     integer;
  v_non_inst     integer;
BEGIN
  -- Même garde que `admin_analytics` (migration 52). Il n'existe pas de
  -- permission « analytics » dans le modèle de rôles : les statistiques
  -- restent réservées aux administrateurs.
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_deb := timezone('utc'::text, now()) - make_interval(days => GREATEST(1, p_days));

  SELECT count(DISTINCT user_id) INTO v_total FROM public.app_installs;

  SELECT count(DISTINCT user_id) INTO v_periode
  FROM public.app_installs WHERE installed_at >= v_deb;

  -- Une installation « vivante » : ouverte au moins une fois dans les
  -- 30 derniers jours. Au-delà, l'icône est probablement oubliée — ou
  -- l'application désinstallée, ce qu'aucun navigateur ne signale.
  SELECT count(DISTINCT user_id) INTO v_vivantes
  FROM public.app_installs
  WHERE last_seen >= timezone('utc'::text, now()) - interval '30 days';

  -- Membres actifs sur la période, pour rapporter l'installation à une
  -- base comparable : la rapporter au total des inscrits diluerait le
  -- chiffre dans les comptes dormants.
  SELECT count(*) INTO v_actifs
  FROM public.profiles WHERE last_seen >= v_deb;

  SELECT count(*) INTO v_actifs_inst
  FROM public.profiles p
  WHERE p.last_seen >= v_deb
    AND EXISTS (SELECT 1 FROM public.app_installs i WHERE i.user_id = p.id);

  v_non_inst := GREATEST(0, v_actifs - v_actifs_inst);

  -- Croisement avec les notifications : les deux se renforcent, et sur
  -- iPhone l'installation CONDITIONNE le push.
  SELECT count(DISTINCT s.user_id) INTO v_push_inst
  FROM public.push_subscriptions s
  WHERE EXISTS (SELECT 1 FROM public.app_installs i WHERE i.user_id = s.user_id);

  SELECT count(DISTINCT s.user_id) INTO v_push_non
  FROM public.push_subscriptions s
  WHERE NOT EXISTS (SELECT 1 FROM public.app_installs i WHERE i.user_id = s.user_id);

  RETURN jsonb_build_object(
    'periode_jours',    p_days,
    'total',            v_total,
    'periode',          v_periode,
    'vivantes',         v_vivantes,
    'actifs',           v_actifs,
    'actifs_installes', v_actifs_inst,
    'part_actifs',      CASE WHEN v_actifs > 0
                          THEN round(v_actifs_inst * 100.0 / v_actifs, 1) ELSE 0 END,

    'par_plateforme', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'n' DESC)
      FROM (
        SELECT jsonb_build_object(
          'plateforme', platform,
          'n', count(*)::integer,
          'confirmees', count(*) FILTER (WHERE source = 'evenement')::integer
        ) AS x
        FROM public.app_installs GROUP BY platform
      ) t
    ), '[]'::jsonb),

    -- Courbe des installations, un point par jour.
    'courbe', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('jour', j::date, 'n', COALESCE(c.n, 0)) ORDER BY j)
      FROM generate_series(v_deb::date, timezone('utc'::text, now())::date, '1 day') j
      LEFT JOIN (
        SELECT installed_at::date AS d, count(*)::integer AS n
        FROM public.app_installs WHERE installed_at >= v_deb
        GROUP BY 1
      ) c ON c.d = j::date
    ), '[]'::jsonb),

    -- LE chiffre décisif : l'installation change-t-elle le comportement ?
    -- Messages envoyés sur la période, ramenés par membre.
    'engagement', jsonb_build_object(
      'installes_n',     v_actifs_inst,
      'non_installes_n', v_non_inst,
      'msg_installes', COALESCE((
        SELECT round(count(*)::numeric / NULLIF(v_actifs_inst, 0), 1)
        FROM public.messages m
        WHERE m.created_at >= v_deb
          AND EXISTS (SELECT 1 FROM public.app_installs i WHERE i.user_id = m.sender_id)
      ), 0),
      'msg_non_installes', COALESCE((
        SELECT round(count(*)::numeric / NULLIF(v_non_inst, 0), 1)
        FROM public.messages m
        WHERE m.created_at >= v_deb
          AND NOT EXISTS (SELECT 1 FROM public.app_installs i WHERE i.user_id = m.sender_id)
      ), 0)
    ),

    'push', jsonb_build_object(
      'installes',     v_push_inst,
      'non_installes', v_push_non,
      'part_installes', CASE WHEN v_total > 0
                          THEN round(v_push_inst * 100.0 / v_total, 1) ELSE 0 END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_install_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_install_stats(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT public.admin_install_stats(30);
