-- ============================================================
-- /admin/utilisateurs enrichi — indicateurs, segments, fiche membre
-- ============================================================
-- Trois apports, dans l'ordre convenu :
--
--   1. Des effectifs de composition et d'économie, dont le RATIO
--      FEMMES/HOMMES — l'indicateur le plus déterminant d'une application
--      de rencontre, et le seul qui alerte avant que le chiffre d'affaires
--      ne bouge.
--
--   2. Des segments transversaux, cumulables avec l'offre, appliqués EN
--      BASE. Filtrer 50 lignes déjà chargées reproduirait le défaut
--      corrigé sur la découverte : chercher les inactifs ne parcourrait
--      que la page affichée.
--
--   3. Une fiche membre complète, pour cesser de naviguer entre quatre
--      pages afin d'instruire un seul cas.

-- ------------------------------------------------------------
-- 1. Index de soutien
-- ------------------------------------------------------------
-- Les segments interrogent ces colonnes à chaque affichage.
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles (last_seen DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS profiles_premium_until_actif_idx
  ON public.profiles (premium_until) WHERE premium_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);
CREATE INDEX IF NOT EXISTS payments_user_completed_idx
  ON public.payments (user_id, completed_at DESC) WHERE status = 'completed';

-- ------------------------------------------------------------
-- 2. Effectifs : composition et économie
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_plan_counts()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now     timestamp with time zone := timezone('utc'::text, now());
  v_total   integer;
  v_payants integer;
  v_ca      bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT count(*) INTO v_total FROM public.profiles;

  SELECT count(DISTINCT user_id), COALESCE(sum(amount_xof), 0)
  INTO v_payants, v_ca
  FROM public.payments WHERE status = 'completed';

  RETURN jsonb_build_object(
    'total', v_total,

    -- ── Répartition par offre ──────────────────────────────
    'gratuit', (SELECT count(*) FROM public.profiles
                WHERE NOT is_founder
                  AND (public_plan = 'gratuit' OR premium_until IS NULL OR premium_until <= v_now)),
    'premium', (SELECT count(*) FROM public.profiles
                WHERE NOT is_founder AND public_plan = 'premium' AND premium_until > v_now),
    'vip',     (SELECT count(*) FROM public.profiles
                WHERE is_founder OR (public_plan = 'vip' AND premium_until > v_now)),
    'fondateurs', (SELECT count(*) FROM public.profiles WHERE is_founder),
    'expires', (SELECT count(*) FROM public.profiles
                WHERE NOT is_founder AND public_plan <> 'gratuit'
                  AND premium_until IS NOT NULL AND premium_until <= v_now),

    -- ── Composition ────────────────────────────────────────
    'nouveaux_7j',  (SELECT count(*) FROM public.profiles
                     WHERE created_at >= v_now - interval '7 days'),
    'femmes',       (SELECT count(*) FROM public.profiles WHERE gender = 'female'),
    'hommes',       (SELECT count(*) FROM public.profiles WHERE gender = 'male'),
    'genre_absent', (SELECT count(*) FROM public.profiles
                     WHERE gender IS NULL OR gender NOT IN ('female', 'male')),
    'actifs_7j',    (SELECT count(*) FROM public.profiles
                     WHERE last_seen >= v_now - interval '7 days'),
    'actifs_30j',   (SELECT count(*) FROM public.profiles
                     WHERE last_seen >= v_now - interval '30 days'),
    'verifies',     (SELECT count(*) FROM public.profiles WHERE is_verified),
    'non_verifies', (SELECT count(*) FROM public.profiles WHERE NOT COALESCE(is_verified, false)),

    -- ── Économie ───────────────────────────────────────────
    'payants', v_payants,
    'ca_total', v_ca,
    -- Revenu moyen par membre AYANT PAYÉ, pas par membre inscrit : diluer
    -- sur toute la base donnerait un chiffre décoratif qui ne pilote rien.
    'revenu_par_payant', CASE WHEN v_payants > 0 THEN (v_ca / v_payants)::integer ELSE 0 END,
    'taux_conversion', CASE WHEN v_total > 0
                       THEN ROUND((v_payants::numeric / v_total) * 100, 1) ELSE 0 END,
    'expire_7j', (SELECT count(*) FROM public.profiles
                  WHERE NOT is_founder AND premium_until > v_now
                    AND premium_until <= v_now + interval '7 days'),

    -- ── Segments d'alerte ──────────────────────────────────
    'inactifs_30j', (SELECT count(*) FROM public.profiles
                     WHERE last_seen IS NULL OR last_seen < v_now - interval '30 days'),
    'signales',     (SELECT count(DISTINCT reported_id) FROM public.reports WHERE status = 'pending'),
    'en_pause',     (SELECT count(*) FROM public.profiles WHERE visibility = 'pause')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_plan_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_plan_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_plan_counts() TO authenticated;

-- ------------------------------------------------------------
-- 3. Liste : segments transversaux et colonnes enrichies
-- ------------------------------------------------------------
-- Le type de retour change : DROP obligatoire, `CREATE OR REPLACE` refuse
-- toute modification de signature de sortie.
DROP FUNCTION IF EXISTS public.admin_users_by_plan(text, text, integer, integer);

CREATE FUNCTION public.admin_users_by_plan(
  p_plan     text    DEFAULT 'all',
  p_search   text    DEFAULT NULL,
  p_limit    integer DEFAULT 50,
  p_offset   integer DEFAULT 0,
  -- Segment transversal, cumulable avec l'offre
  p_segment  text    DEFAULT NULL,
  p_gender   text    DEFAULT NULL,
  p_country  text    DEFAULT NULL,
  p_verified boolean DEFAULT NULL
)
RETURNS TABLE (
  id uuid, first_name text, last_name text, city text, country text,
  gender text, is_verified boolean, is_founder boolean,
  public_plan text, premium_until timestamp with time zone,
  created_at timestamp with time zone, last_seen timestamp with time zone,
  photos text[], denomination text, visibility text,
  total_paye integer, nb_paiements integer,
  dernier_paiement timestamp with time zone, derniere_offre text,
  completion integer,
  nb_matchs integer, nb_messages integer,
  nb_likes_donnes integer, nb_likes_recus integer,
  nb_signalements integer, nb_blocages integer, nb_tickets integer,
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_q   text := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;

  RETURN QUERY
  WITH filtres AS (
    SELECT p.*
    FROM public.profiles p
    WHERE
      -- Offre
      (
        p_plan = 'all'
        OR (p_plan = 'gratuit' AND NOT p.is_founder
            AND (p.public_plan = 'gratuit' OR p.premium_until IS NULL OR p.premium_until <= v_now))
        OR (p_plan = 'premium' AND NOT p.is_founder
            AND p.public_plan = 'premium' AND p.premium_until > v_now)
        OR (p_plan = 'vip' AND (p.is_founder OR (p.public_plan = 'vip' AND p.premium_until > v_now)))
      )
      -- Segment transversal
      AND (
        p_segment IS NULL
        OR (p_segment = 'inactifs'
            AND (p.last_seen IS NULL OR p.last_seen < v_now - interval '30 days'))
        OR (p_segment = 'incomplet' AND public.profile_completion(p.id) < 50)
        OR (p_segment = 'signales' AND EXISTS (
              SELECT 1 FROM public.reports r
              WHERE r.reported_id = p.id AND r.status = 'pending'))
        OR (p_segment = 'expire_bientot'
            AND NOT p.is_founder
            AND p.premium_until > v_now
            AND p.premium_until <= v_now + interval '7 days')
        -- « Jamais swipé » : l'accueil n'a pas fonctionné pour ces
        -- personnes. C'est le segment le plus actionnable des premiers mois.
        OR (p_segment = 'jamais_swipe' AND NOT EXISTS (
              SELECT 1 FROM public.swipes s WHERE s.swiper_id = p.id))
        OR (p_segment = 'en_pause' AND p.visibility = 'pause')
      )
      AND (p_gender   IS NULL OR p.gender = p_gender)
      AND (p_country  IS NULL OR p.country = p_country)
      AND (p_verified IS NULL OR COALESCE(p.is_verified, false) = p_verified)
      AND (
        v_q IS NULL
        OR p.first_name ILIKE '%' || v_q || '%'
        OR p.last_name  ILIKE '%' || v_q || '%'
        OR p.city       ILIKE '%' || v_q || '%'
        OR p.country    ILIKE '%' || v_q || '%'
      )
  ),
  -- La page est réduite AVANT les sous-requêtes de comptage : sans ce
  -- découpage, les huit agrégats tourneraient sur toute la base filtrée
  -- au lieu des 50 lignes affichées.
  page AS (
    SELECT * FROM filtres ORDER BY created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    OFFSET GREATEST(0, COALESCE(p_offset, 0))
  )
  SELECT
    f.id, f.first_name, f.last_name, f.city, f.country,
    f.gender, f.is_verified, f.is_founder,
    f.public_plan, f.premium_until,
    f.created_at, f.last_seen,
    f.photos, f.denomination, COALESCE(f.visibility, 'tous'),

    COALESCE((SELECT sum(pay.amount_xof)::integer FROM public.payments pay
              WHERE pay.user_id = f.id AND pay.status = 'completed'), 0),
    COALESCE((SELECT count(*)::integer FROM public.payments pay
              WHERE pay.user_id = f.id AND pay.status = 'completed'), 0),
    (SELECT max(pay.completed_at) FROM public.payments pay
     WHERE pay.user_id = f.id AND pay.status = 'completed'),
    (SELECT pay.offer_id FROM public.payments pay
     WHERE pay.user_id = f.id AND pay.status = 'completed'
     ORDER BY pay.completed_at DESC LIMIT 1),

    public.profile_completion(f.id),

    COALESCE((SELECT count(*)::integer FROM public.matches m
              WHERE m.user1_id = f.id OR m.user2_id = f.id), 0),
    COALESCE((SELECT count(*)::integer FROM public.messages ms
              WHERE ms.sender_id = f.id), 0),
    COALESCE((SELECT count(*)::integer FROM public.swipes s
              WHERE s.swiper_id = f.id AND s.action IN ('like', 'superlike')), 0),
    COALESCE((SELECT count(*)::integer FROM public.swipes s
              WHERE s.target_id = f.id AND s.action IN ('like', 'superlike')), 0),

    COALESCE((SELECT count(*)::integer FROM public.reports r
              WHERE r.reported_id = f.id AND r.status = 'pending'), 0),
    -- Blocages SUBIS : on bloque souvent sans signaler. Trois blocages
    -- sans aucun signalement révèlent un comportement qui n'est jamais
    -- remonté à la modération.
    COALESCE((SELECT count(*)::integer FROM public.blocks b
              WHERE b.blocked_id = f.id), 0),
    COALESCE((SELECT count(*)::integer FROM public.support_tickets t
              WHERE t.user_id = f.id AND t.status IN ('open', 'pending')), 0),

    (SELECT count(*) FROM filtres)
  FROM page f
  ORDER BY f.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_by_plan(
  text, text, integer, integer, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_users_by_plan(
  text, text, integer, integer, text, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_users_by_plan(
  text, text, integer, integer, text, text, text, boolean) TO authenticated;

-- ------------------------------------------------------------
-- 4. Journal des gestes commerciaux
-- ------------------------------------------------------------
-- Déclaré AVANT la fiche membre, qui le lit. Journalisé systématiquement :
-- un accès offert sans trace est indistinguable d'un bug de facturation
-- trois mois plus tard.
CREATE TABLE IF NOT EXISTS public.admin_grants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  days integer NOT NULL CHECK (days BETWEEN 1 AND 365),
  plan_id text NOT NULL DEFAULT 'premium' CHECK (plan_id IN ('premium', 'vip')),
  reason text NOT NULL CHECK (length(trim(reason)) >= 5),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_grants_user_idx ON public.admin_grants (user_id, created_at DESC);

ALTER TABLE public.admin_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read grants" ON public.admin_grants;
CREATE POLICY "Admins read grants"
ON public.admin_grants FOR SELECT TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------
-- 5. Fiche membre complète
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamp with time zone := timezone('utc'::text, now());
  p     record;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'profil', jsonb_build_object(
      'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
      'birth_date', p.birth_date, 'gender', p.gender,
      'city', p.city, 'country', p.country,
      'photos', COALESCE(p.photos, '{}'), 'bio', p.bio,
      'denomination', p.denomination, 'practice_level', p.practice_level,
      'church_attendance', p.church_attendance, 'marriage_intent', p.marriage_intent,
      'marital_status', p.marital_status, 'marriage_vision', p.marriage_vision,
      'looking_for', p.looking_for, 'education', p.education, 'height_cm', p.height_cm,
      'interests', COALESCE(p.interests, '{}'), 'qualities', COALESCE(p.qualities, '{}'),
      'flaws', COALESCE(p.flaws, '{}'), 'dealbreakers', COALESCE(p.dealbreakers, '{}'),
      'is_verified', p.is_verified, 'is_founder', p.is_founder,
      'visibility', COALESCE(p.visibility, 'tous'),
      'share_location', COALESCE(p.share_location, false),
      'created_at', p.created_at, 'last_seen', p.last_seen,
      'public_plan', p.public_plan, 'premium_until', p.premium_until,
      'boosted_until', p.boosted_until,
      'completion', public.profile_completion(p.id)
    ),

    -- Les paiements EN ATTENTE et ÉCHOUÉS sont inclus : c'est là qu'on
    -- comprend pourquoi quelqu'un se plaint de ne pas avoir son accès.
    'paiements', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', pay.id, 'offer_id', pay.offer_id, 'plan_id', pay.plan_id,
        'amount_xof', pay.amount_xof, 'days', pay.days, 'status', pay.status,
        'sale_id', pay.sale_id,
        'created_at', pay.created_at, 'completed_at', pay.completed_at
      ) ORDER BY pay.created_at DESC), '[]'::jsonb)
      FROM public.payments pay WHERE pay.user_id = p_user_id
    ),

    'activite', jsonb_build_object(
      'matchs',        (SELECT count(*) FROM public.matches m
                        WHERE m.user1_id = p_user_id OR m.user2_id = p_user_id),
      'messages_envoyes', (SELECT count(*) FROM public.messages ms WHERE ms.sender_id = p_user_id),
      'likes_donnes',  (SELECT count(*) FROM public.swipes s
                        WHERE s.swiper_id = p_user_id AND s.action IN ('like','superlike')),
      'likes_recus',   (SELECT count(*) FROM public.swipes s
                        WHERE s.target_id = p_user_id AND s.action IN ('like','superlike')),
      'passes',        (SELECT count(*) FROM public.swipes s
                        WHERE s.swiper_id = p_user_id AND s.action = 'pass'),
      'publications',  (SELECT count(*) FROM public.community_posts c WHERE c.user_id = p_user_id),
      'visites_recues',(SELECT count(*) FROM public.profile_visits v WHERE v.visited_id = p_user_id),
      'boosts',        (SELECT count(*) FROM public.boosts b WHERE b.user_id = p_user_id)
    ),

    'moderation', jsonb_build_object(
      -- Signalements REÇUS, avec le motif et le texte libre : c'est le
      -- détail qui permet de trancher, pas le compteur.
      'recus', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', r.id, 'reason', r.reason, 'details', r.details,
          'context', r.context, 'status', r.status, 'created_at', r.created_at
        ) ORDER BY r.created_at DESC), '[]'::jsonb)
        FROM public.reports r WHERE r.reported_id = p_user_id
      ),
      -- Un membre qui signale beaucoup sans jamais être signalé n'est pas
      -- le même cas qu'un membre signalé par cinq personnes.
      'emis_n',      (SELECT count(*) FROM public.reports r WHERE r.reporter_id = p_user_id),
      'bloque_par_n',(SELECT count(*) FROM public.blocks b WHERE b.blocked_id = p_user_id),
      'a_bloque_n',  (SELECT count(*) FROM public.blocks b WHERE b.blocker_id = p_user_id)
    ),

    'support', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', t.id, 'subject', t.subject, 'category', t.category,
        'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at
      ) ORDER BY t.updated_at DESC), '[]'::jsonb)
      FROM public.support_tickets t WHERE t.user_id = p_user_id
    ),

    'gestes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'days', g.days, 'reason', g.reason, 'created_at', g.created_at
      ) ORDER BY g.created_at DESC), '[]'::jsonb)
      FROM public.admin_grants g WHERE g.user_id = p_user_id
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- 6. Offrir des jours d'accès
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_days(
  p_user_id uuid,
  p_days integer,
  p_reason text,
  p_plan text DEFAULT 'premium'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_base  timestamp with time zone;
  v_fin   timestamp with time zone;
  v_now   timestamp with time zone := timezone('utc'::text, now());
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'days');
  END IF;

  IF length(trim(COALESCE(p_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'motif');
  END IF;

  IF p_plan NOT IN ('premium', 'vip') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan');
  END IF;

  -- On PROLONGE une période encore active plutôt que de l'écraser :
  -- offrir 7 jours à quelqu'un qui en a 60 ne doit pas lui en retirer 53.
  SELECT GREATEST(COALESCE(premium_until, v_now), v_now) INTO v_base
  FROM public.profiles WHERE id = p_user_id;

  IF v_base IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'introuvable');
  END IF;

  v_fin := v_base + make_interval(days => p_days);

  UPDATE public.profiles
  SET premium_until = v_fin,
      -- Un geste VIP ne rétrograde pas quelqu'un déjà VIP.
      public_plan = CASE
        WHEN public_plan = 'vip' OR p_plan = 'vip' THEN 'vip'
        ELSE 'premium' END
  WHERE id = p_user_id;

  -- Dans ON CONFLICT DO UPDATE, la ligne existante se désigne par le nom
  -- NON QUALIFIÉ de la table ; `public.subscriptions.plan_id` provoquerait
  -- une erreur — c'est exactement ce qu'avait corrigé la migration 19.
  INSERT INTO public.subscriptions (user_id, plan_id, expires_at, started_at, updated_at)
  VALUES (p_user_id, p_plan, v_fin, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE
  SET plan_id    = CASE WHEN subscriptions.plan_id = 'vip' OR EXCLUDED.plan_id = 'vip'
                        THEN 'vip' ELSE 'premium' END,
      expires_at = EXCLUDED.expires_at,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.admin_grants (user_id, granted_by, days, plan_id, reason)
  VALUES (p_user_id, v_admin, p_days, p_plan, trim(p_reason));

  RETURN jsonb_build_object('ok', true, 'expires_at', v_fin, 'plan', p_plan);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_grant_days(uuid, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_grant_days(uuid, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_days(uuid, integer, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 7. Contrôle
-- ------------------------------------------------------------
SELECT public.admin_plan_counts() AS effectifs;

SELECT first_name, completion, nb_matchs, nb_messages, nb_signalements, nb_blocages
FROM public.admin_users_by_plan(p_limit => 5);

SELECT public.admin_user_detail(
  (SELECT id FROM public.profiles ORDER BY created_at DESC LIMIT 1)
) AS fiche;
