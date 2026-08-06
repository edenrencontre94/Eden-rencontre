-- ============================================================
-- Motifs de signalement et de suppression de compte
-- ============================================================
-- Deux angles morts :
--
-- 1. `reportUser()` était appelé SANS motif depuis /demandes et /messages.
--    La colonne `reason` existait et restait vide : la modération recevait
--    « quelqu'un a signalé quelqu'un », sans savoir pourquoi.
--
-- 2. La suppression de compte ne demandait rien. Un membre qui part parce
--    qu'il a été harcelé et un membre qui part parce qu'il s'est marié
--    laissaient exactement la même trace : aucune.
--
-- Le motif de départ est la seule information qu'on ne peut pas
-- reconstituer après coup. Elle se recueille au moment du départ, ou
-- jamais.

-- ------------------------------------------------------------
-- 1. Signalements : vocabulaire contrôlé + texte libre
-- ------------------------------------------------------------
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS details text;

-- Le motif reste nullable : les signalements déjà enregistrés n'en ont
-- pas, et une contrainte NOT NULL ferait échouer la migration sur
-- l'existant. C'est la fonction d'insertion qui l'impose désormais.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_reason_known') THEN
    ALTER TABLE public.reports
    ADD CONSTRAINT reports_reason_known CHECK (
      reason IS NULL OR reason IN (
        'faux_profil', 'contenu_inapproprie', 'harcelement', 'arnaque',
        'discours_haineux', 'mineur', 'hors_sujet', 'autre'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reports_reason_idx ON public.reports (reason);

-- Signaler passe par une fonction : elle impose le motif, empêche de se
-- signaler soi-même, et bloque la répétition du même signalement — sans
-- quoi une personne fâchée pourrait en déposer cinquante et fausser
-- entièrement les statistiques de modération.
CREATE OR REPLACE FUNCTION public.submit_report(
  p_reported_id uuid,
  p_reason text,
  p_details text DEFAULT NULL,
  p_context text DEFAULT 'profile'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id   uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;

  IF p_reported_id = v_user THEN
    RAISE EXCEPTION 'SELF_REPORT' USING HINT = 'On ne se signale pas soi-même.';
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN (
    'faux_profil', 'contenu_inapproprie', 'harcelement', 'arnaque',
    'discours_haineux', 'mineur', 'hors_sujet', 'autre'
  ) THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING HINT = 'Choisissez un motif.';
  END IF;

  -- « Autre » sans explication n'apprend rien à personne.
  IF p_reason = 'autre' AND length(trim(COALESCE(p_details, ''))) < 10 THEN
    RAISE EXCEPTION 'DETAILS_REQUIRED'
      USING HINT = 'Précisez en quelques mots ce que vous signalez.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.reporter_id = v_user
      AND r.reported_id = p_reported_id
      AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'ALREADY_REPORTED'
      USING HINT = 'Votre signalement précédent est encore en cours d''examen.';
  END IF;

  INSERT INTO public.reports (reporter_id, reported_id, context, reason, details)
  VALUES (v_user, p_reported_id, COALESCE(p_context, 'profile'), p_reason,
          NULLIF(trim(COALESCE(p_details, '')), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_report(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_report(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_report(uuid, text, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 2. Départs : une table qui SURVIT au compte
-- ------------------------------------------------------------
-- Aucune clé étrangère vers `profiles`. C'est délibéré : avec
-- `ON DELETE CASCADE`, le motif serait effacé au moment même où il devient
-- utile. `user_id` n'est conservé que pour rapprocher un départ d'un
-- signalement en cours ; rien d'autre d'identifiant n'est stocké.
CREATE TABLE IF NOT EXISTS public.account_deletions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  reason text NOT NULL CHECK (reason IN (
    'trouve_partenaire',    -- bonne nouvelle : ne pas la confondre avec un échec
    'peu_de_profils',
    'pas_de_reponses',
    'trop_cher',
    'probleme_technique',
    'mauvaise_experience',  -- harcèlement, comportements déplacés
    'pause',
    'vie_privee',
    'autre'
  )),
  details text,
  -- Contexte conservé au moment du départ : après suppression du profil,
  -- il serait impossible à reconstituer.
  jours_actif integer,
  avait_paye boolean DEFAULT false,
  pays text,
  genre text,
  nb_matchs integer,
  nb_messages integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS account_deletions_reason_idx
  ON public.account_deletions (reason, created_at DESC);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- Personne n'y accède directement : l'écriture passe par la fonction
-- ci-dessous, la lecture par la fonction d'administration.
DROP POLICY IF EXISTS "Admins read deletions" ON public.account_deletions;
CREATE POLICY "Admins read deletions"
ON public.account_deletions FOR SELECT TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------
-- 3. Supprimer son compte, motif recueilli
-- ------------------------------------------------------------
-- Tout se fait dans une seule transaction. Avec deux requêtes séparées
-- depuis le navigateur, une coupure entre l'enregistrement du motif et la
-- suppression laisserait soit un motif orphelin, soit un compte supprimé
-- sans explication — le cas le plus fréquent, puisque l'utilisateur ferme
-- souvent l'onglet dès la suppression lancée.
CREATE OR REPLACE FUNCTION public.delete_my_account(
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_created  timestamp with time zone;
  v_pays     text;
  v_genre    text;
  v_paye     boolean;
  v_matchs   integer;
  v_messages integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;

  IF p_reason IS NULL OR p_reason NOT IN (
    'trouve_partenaire', 'peu_de_profils', 'pas_de_reponses', 'trop_cher',
    'probleme_technique', 'mauvaise_experience', 'pause', 'vie_privee', 'autre'
  ) THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING HINT = 'Indiquez un motif de départ.';
  END IF;

  IF p_reason = 'autre' AND length(trim(COALESCE(p_details, ''))) < 10 THEN
    RAISE EXCEPTION 'DETAILS_REQUIRED'
      USING HINT = 'Dites-nous en quelques mots ce qui vous fait partir.';
  END IF;

  SELECT p.created_at, p.country, p.gender
  INTO v_created, v_pays, v_genre
  FROM public.profiles p WHERE p.id = v_user;

  SELECT EXISTS (
    SELECT 1 FROM public.payments WHERE user_id = v_user AND status = 'completed'
  ) INTO v_paye;

  SELECT count(*) INTO v_matchs FROM public.matches
  WHERE user1_id = v_user OR user2_id = v_user;

  SELECT count(*) INTO v_messages FROM public.messages WHERE sender_id = v_user;

  INSERT INTO public.account_deletions (
    user_id, reason, details, jours_actif, avait_paye, pays, genre,
    nb_matchs, nb_messages
  ) VALUES (
    v_user, p_reason, NULLIF(trim(COALESCE(p_details, '')), ''),
    GREATEST(0, EXTRACT(DAY FROM timezone('utc'::text, now()) - v_created)::integer),
    COALESCE(v_paye, false), v_pays, v_genre,
    COALESCE(v_matchs, 0), COALESCE(v_messages, 0)
  );

  -- La suppression du profil entraîne en cascade swipes, matchs, messages,
  -- publications et abonnement. La ligne `account_deletions` reste, elle
  -- n'a pas de clé étrangère.
  DELETE FROM public.profiles WHERE id = v_user;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_account(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text, text) TO authenticated;

-- ------------------------------------------------------------
-- 4. Lecture par le back-office
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_departures(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'total',    (SELECT count(*) FROM public.account_deletions),
    'total_30d',(SELECT count(*) FROM public.account_deletions
                 WHERE created_at >= timezone('utc'::text, now()) - interval '30 days'),
    -- Un départ « j'ai trouvé quelqu'un » est un succès, pas une perte.
    -- Les mélanger dans un taux d'attrition unique donnerait une lecture
    -- fausse de la santé de la plateforme.
    'succes',   (SELECT count(*) FROM public.account_deletions
                 WHERE reason = 'trouve_partenaire'),
    'payants_perdus', (SELECT count(*) FROM public.account_deletions
                       WHERE avait_paye AND reason <> 'trouve_partenaire'),
    'jours_actif_median', (
      SELECT ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY jours_actif)::numeric, 0)
      FROM public.account_deletions WHERE jours_actif IS NOT NULL
    ),
    'par_motif', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'motif', reason, 'n', n, 'payants', payants,
        'jours_moyen', jours) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT reason,
               count(*) AS n,
               count(*) FILTER (WHERE avait_paye) AS payants,
               ROUND(AVG(jours_actif)::numeric, 0) AS jours
        FROM public.account_deletions GROUP BY reason
      ) x
    ),
    'recents', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'motif', reason, 'details', details,
        'jours_actif', jours_actif, 'avait_paye', avait_paye,
        'pays', pays, 'genre', genre, 'nb_matchs', nb_matchs,
        'nb_messages', nb_messages, 'created_at', created_at
      ) ORDER BY created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM public.account_deletions
        ORDER BY created_at DESC LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
      ) y
    ),
    'signalements_par_motif', (
      SELECT COALESCE(jsonb_object_agg(COALESCE(reason, 'non_precise'), n), '{}'::jsonb)
      FROM (SELECT reason, count(*) AS n FROM public.reports GROUP BY reason) z
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_departures(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_departures(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_departures(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 5. Contrôle
-- ------------------------------------------------------------
SELECT public.admin_departures(10) AS departs;
SELECT reason, count(*) FROM public.reports GROUP BY reason ORDER BY count DESC;
