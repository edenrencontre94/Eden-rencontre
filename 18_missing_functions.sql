-- ============================================================
-- 18_missing_functions.sql
-- Fonctions SQL manquantes identifiées lors de l'audit de production.
--
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ─── 1. enregistrer_visite_pub ──────────────────────────────
-- Enregistre une visite de la landing page avec paramètres UTM.
-- Utilisé par src/lib/meta.ts pour le tracking d'acquisition.
CREATE OR REPLACE FUNCTION public.enregistrer_visite_pub(
  p_session       TEXT,
  p_utm_source    TEXT DEFAULT NULL,
  p_utm_medium    TEXT DEFAULT NULL,
  p_utm_campaign  TEXT DEFAULT NULL,
  p_utm_content   TEXT DEFAULT NULL,
  p_utm_term      TEXT DEFAULT NULL,
  p_fbclid        TEXT DEFAULT NULL,
  p_path          TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insérer si la session n'existe pas encore (évite les doublons)
  INSERT INTO public.install_stats (
    platform, source, user_agent, created_at,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, path, session_token
  )
  VALUES (
    'web', 'visite', p_path, now(),
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_fbclid, p_path, p_session
  )
  ON CONFLICT (session_token) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  -- La table install_stats peut ne pas avoir toutes les colonnes — on ignore silencieusement
  NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enregistrer_visite_pub TO anon, authenticated;

-- ─── 2. rattacher_provenance ────────────────────────────────
-- Rattache la source d'acquisition (UTM/fbclid) au profil de
-- l'utilisateur au moment de son inscription.
-- Utilisé par src/lib/meta.ts → rattacherProvenance()
CREATE OR REPLACE FUNCTION public.rattacher_provenance(
  p_utm_source    TEXT DEFAULT NULL,
  p_utm_medium    TEXT DEFAULT NULL,
  p_utm_campaign  TEXT DEFAULT NULL,
  p_utm_content   TEXT DEFAULT NULL,
  p_utm_term      TEXT DEFAULT NULL,
  p_fbclid        TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET
    utm_source    = COALESCE(utm_source, p_utm_source),
    utm_medium    = COALESCE(utm_medium, p_utm_medium),
    utm_campaign  = COALESCE(utm_campaign, p_utm_campaign),
    utm_content   = COALESCE(utm_content, p_utm_content),
    utm_term      = COALESCE(utm_term, p_utm_term),
    fbclid        = COALESCE(fbclid, p_fbclid)
  WHERE id = auth.uid();
EXCEPTION WHEN OTHERS THEN
  -- Si les colonnes UTM n'existent pas encore, on ignore
  NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rattacher_provenance TO authenticated;

-- ─── 3. signaler_installation ───────────────────────────────
-- Enregistre une installation PWA ou une ouverture depuis l'écran d'accueil.
-- Utilisé par src/lib/install.ts
CREATE OR REPLACE FUNCTION public.signaler_installation(
  p_platform    TEXT,
  p_source      TEXT,
  p_user_agent  TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.install_stats (
    user_id, platform, source, user_agent, created_at
  )
  VALUES (
    auth.uid(), p_platform, p_source, p_user_agent, now()
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.signaler_installation TO authenticated;

-- ─── 4. admin_plan_counts ───────────────────────────────────
-- Retourne les compteurs d'utilisateurs par plan.
-- Utilisé par src/lib/adminUsers.ts
CREATE OR REPLACE FUNCTION public.admin_plan_counts()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator','super_admin')
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN (
    SELECT json_build_object(
      'gratuit',      COUNT(*) FILTER (WHERE public_plan = 'gratuit' OR public_plan = 'free' OR public_plan IS NULL),
      'premium',      COUNT(*) FILTER (WHERE public_plan = 'premium' AND (premium_until IS NULL OR premium_until > now()) OR is_founder),
      'expires_soon', COUNT(*) FILTER (WHERE public_plan = 'premium' AND premium_until BETWEEN now() AND now() + INTERVAL '7 days'),
      'total',        COUNT(*)
    )
    FROM public.profiles
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_plan_counts TO authenticated;

-- ─── 5. my_suspension ───────────────────────────────────────
-- Retourne les informations de suspension de l'utilisateur courant.
-- Utilisé par src/routes/_app.tsx
CREATE OR REPLACE FUNCTION public.my_suspension()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT suspended, suspension_reason, suspended_until
  INTO p
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT COALESCE(p.suspended, false) THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'suspended',        p.suspended,
    'reason',           p.suspension_reason,
    'suspended_until',  p.suspended_until
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_suspension TO authenticated;

-- ─── 6. Ajout des colonnes UTM dans profiles (si absentes) ──
-- Ces colonnes sont nécessaires pour la fonction rattacher_provenance
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT,
  ADD COLUMN IF NOT EXISTS utm_term     TEXT,
  ADD COLUMN IF NOT EXISTS fbclid       TEXT;

-- ─── 7. Ajout des colonnes dans install_stats (si absentes) ─
ALTER TABLE public.install_stats
  ADD COLUMN IF NOT EXISTS session_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS utm_source    TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium    TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign  TEXT,
  ADD COLUMN IF NOT EXISTS utm_content   TEXT,
  ADD COLUMN IF NOT EXISTS utm_term      TEXT,
  ADD COLUMN IF NOT EXISTS fbclid        TEXT,
  ADD COLUMN IF NOT EXISTS path          TEXT;

-- ─── 8. Ajout des colonnes de suspension dans profiles ──────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspension_reason  TEXT,
  ADD COLUMN IF NOT EXISTS suspended_until    TIMESTAMP WITH TIME ZONE;
