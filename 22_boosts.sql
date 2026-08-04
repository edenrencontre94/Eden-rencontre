-- ============================================================
-- Migration : Boost de profil
-- ============================================================
-- Le bouton Boost existait mais ne produisait aucun effet : il décrémentait
-- un compteur dans le localStorage et affichait un message. Aucun profil
-- n'était réellement mis en avant, et le quota se remettait à zéro en
-- vidant le navigateur.
--
-- Ici le quota est compté en base et le classement de la découverte
-- s'appuie sur une colonne réelle.

-- ------------------------------------------------------------
-- 1. Marqueur lu par la découverte
-- ------------------------------------------------------------
-- Placé sur `profiles` plutôt que dans une table à joindre : la découverte
-- sélectionne déjà toutes les colonnes du profil, le tri devient gratuit.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS boosted_until timestamp with time zone;

CREATE INDEX IF NOT EXISTS profiles_boosted_idx
ON public.profiles (boosted_until DESC)
WHERE boosted_until IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Registre des boosts — sert au décompte du quota
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boosts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS boosts_user_started_idx ON public.boosts (user_id, started_at DESC);

ALTER TABLE public.boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own boosts" ON public.boosts;
CREATE POLICY "Users read their own boosts"
ON public.boosts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Aucune policy d'écriture : seule la fonction ci-dessous crée un boost.

-- ------------------------------------------------------------
-- 3. Déclenchement d'un boost
-- ------------------------------------------------------------
-- L'utilisateur est déduit de auth.uid(), JAMAIS d'un paramètre : c'est ce
-- qui permet d'exposer la fonction à `authenticated` sans risque. Une
-- fonction SECURITY DEFINER qui accepterait un user_id en argument
-- laisserait n'importe qui booster n'importe quel profil.
CREATE OR REPLACE FUNCTION public.start_boost()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_now       timestamp with time zone := timezone('utc'::text, now());
  v_plan      text := 'gratuit';
  v_expires   timestamp with time zone;
  v_quota     integer;
  v_used      integer;
  v_active    timestamp with time zone;
  v_duration  interval := interval '30 minutes';
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  -- Formule en cours (une période échue ne donne aucun droit)
  SELECT s.plan_id INTO v_plan
  FROM public.subscriptions s
  WHERE s.user_id = v_user
    AND s.expires_at IS NOT NULL
    AND s.expires_at > v_now;

  v_plan := COALESCE(v_plan, 'gratuit');

  -- Quota mensuel : -1 = illimité
  v_quota := CASE v_plan
    WHEN 'vip' THEN -1
    WHEN 'premium' THEN 1
    ELSE 0
  END;

  IF v_quota = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan', 'plan', v_plan);
  END IF;

  -- Un boost déjà actif n'est pas cumulable
  SELECT p.boosted_until INTO v_active
  FROM public.profiles p
  WHERE p.id = v_user;

  IF v_active IS NOT NULL AND v_active > v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'expires_at', v_active);
  END IF;

  IF v_quota > 0 THEN
    SELECT count(*) INTO v_used
    FROM public.boosts b
    WHERE b.user_id = v_user
      AND b.started_at >= date_trunc('month', v_now);

    IF v_used >= v_quota THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'quota', 'used', v_used, 'quota', v_quota);
    END IF;
  END IF;

  v_expires := v_now + v_duration;

  INSERT INTO public.boosts (user_id, plan_id, started_at, expires_at)
  VALUES (v_user, v_plan, v_now, v_expires);

  UPDATE public.profiles
  SET boosted_until = v_expires
  WHERE id = v_user;

  RETURN jsonb_build_object('ok', true, 'expires_at', v_expires, 'plan', v_plan);
END;
$$;

-- Sûre à exposer : elle n'agit que sur auth.uid()
REVOKE ALL ON FUNCTION public.start_boost() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_boost() FROM anon;
GRANT EXECUTE ON FUNCTION public.start_boost() TO authenticated;

-- ------------------------------------------------------------
-- 4. Boosts restants pour le mois en cours
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boosts_left()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_now   timestamp with time zone := timezone('utc'::text, now());
  v_plan  text := 'gratuit';
  v_quota integer;
  v_used  integer;
  v_active timestamp with time zone;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('left', 0, 'quota', 0);
  END IF;

  SELECT s.plan_id INTO v_plan
  FROM public.subscriptions s
  WHERE s.user_id = v_user AND s.expires_at IS NOT NULL AND s.expires_at > v_now;

  v_plan := COALESCE(v_plan, 'gratuit');

  v_quota := CASE v_plan WHEN 'vip' THEN -1 WHEN 'premium' THEN 1 ELSE 0 END;

  SELECT count(*) INTO v_used
  FROM public.boosts b
  WHERE b.user_id = v_user AND b.started_at >= date_trunc('month', v_now);

  SELECT p.boosted_until INTO v_active FROM public.profiles p WHERE p.id = v_user;

  RETURN jsonb_build_object(
    'left', CASE WHEN v_quota = -1 THEN -1 ELSE GREATEST(0, v_quota - v_used) END,
    'quota', v_quota,
    'plan', v_plan,
    'active_until', CASE WHEN v_active > v_now THEN v_active ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.boosts_left() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.boosts_left() FROM anon;
GRANT EXECUTE ON FUNCTION public.boosts_left() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 5. Contrôle
-- ------------------------------------------------------------
SELECT p.proname, p.prosecdef AS security_definer,
       coalesce(array_to_string(p.proacl, ' | '), '(défaut)') AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('start_boost', 'boosts_left');
