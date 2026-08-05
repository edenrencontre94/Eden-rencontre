-- ============================================================
-- Correctif : le fil de la communauté ne se chargeait plus
-- ============================================================
-- La page Communauté demandait `profiles.is_premium`, une colonne qui
-- n'existe pas. PostgREST rejetant TOUTE requête comportant une colonne
-- inconnue, le fil revenait vide : les publications étaient bien
-- enregistrées, mais plus rien ne s'affichait au rechargement.
--
-- On ne peut pas lire l'abonnement d'un autre membre — la RLS de
-- `subscriptions` ne donne accès qu'à sa propre ligne, et c'est voulu.
-- On expose donc une date sur `profiles`, lisible comme le reste du profil.
--
-- Le choix d'une DATE plutôt que d'un booléen est délibéré : un booléen
-- resterait à `true` après l'expiration, faute de tâche planifiée pour le
-- remettre à zéro. Une date se compare à l'instant présent et devient
-- fausse d'elle-même — exactement comme `boosted_until`.

-- ------------------------------------------------------------
-- 1. La colonne
-- ------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS premium_until timestamp with time zone;

CREATE INDEX IF NOT EXISTS profiles_premium_until_idx
ON public.profiles (premium_until)
WHERE premium_until IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Reprise de l'existant
-- ------------------------------------------------------------
UPDATE public.profiles p
SET premium_until = s.expires_at
FROM public.subscriptions s
WHERE s.user_id = p.id
  AND s.expires_at IS NOT NULL
  AND (p.premium_until IS NULL OR p.premium_until < s.expires_at);

-- ------------------------------------------------------------
-- 3. Tenir la colonne à jour à chaque paiement
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_subscription_payment(
  p_user_id uuid,
  p_plan_id text,
  p_days integer,
  p_level smallint DEFAULT 1
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now     timestamp with time zone := timezone('utc'::text, now());
  v_current timestamp with time zone;
  v_level   smallint;
  v_base    timestamp with time zone;
  v_new_end timestamp with time zone;
BEGIN
  IF p_plan_id NOT IN ('premium', 'vip') THEN
    RAISE EXCEPTION 'Plan invalide : %', p_plan_id;
  END IF;
  IF p_days IS NULL OR p_days <= 0 THEN
    RAISE EXCEPTION 'Durée invalide : %', p_days;
  END IF;

  SELECT expires_at, premium_level INTO v_current, v_level
  FROM public.subscriptions WHERE user_id = p_user_id;

  v_base := GREATEST(COALESCE(v_current, v_now), v_now);
  v_new_end := v_base + make_interval(days => p_days);

  v_level := CASE
    WHEN v_current IS NULL OR v_current <= v_now THEN p_level
    ELSE GREATEST(COALESCE(v_level, 1), p_level)
  END;

  INSERT INTO public.subscriptions AS s
    (user_id, plan_id, premium_level, expires_at, started_at, updated_at)
  VALUES (p_user_id, p_plan_id, v_level, v_new_end, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET plan_id       = EXCLUDED.plan_id,
        premium_level = EXCLUDED.premium_level,
        expires_at    = v_new_end,
        started_at    = COALESCE(s.started_at, EXCLUDED.started_at),
        updated_at    = v_now;

  -- Miroir public, pour le badge visible par les autres membres
  UPDATE public.profiles SET premium_until = v_new_end WHERE id = p_user_id;

  RETURN v_new_end;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer, smallint) FROM anon;
REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, integer, smallint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_payment(uuid, text, integer, smallint) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 4. Contrôle
-- ------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE is_founder)                                       AS fondateurs,
  count(*) FILTER (WHERE premium_until > timezone('utc'::text, now()))     AS premium_actifs,
  count(*)                                                                 AS total_profils
FROM public.profiles;
