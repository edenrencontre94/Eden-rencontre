-- ============================================================
-- Migration : abonnements et paiements (Chariow)
-- ============================================================
-- Jusqu'ici l'abonnement vivait UNIQUEMENT dans le localStorage du
-- navigateur (clé « agapemeet.subscription ») : n'importe qui pouvait
-- s'octroyer Premium ou VIP depuis la console. Tout passe désormais en base,
-- et seul le webhook Chariow (service key) peut accorder un abonnement.

-- ------------------------------------------------------------
-- 1. Abonnements — une ligne par utilisateur
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'gratuit' CHECK (plan_id IN ('gratuit', 'premium', 'vip')),
  -- Date de fin de la période payée. NULL = formule gratuite.
  expires_at timestamp with time zone,
  started_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS subscriptions_expires_idx ON public.subscriptions (expires_at);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Lecture seule pour l'utilisateur : il consulte, il ne s'accorde rien.
DROP POLICY IF EXISTS "Users read their own subscription" ON public.subscriptions;
CREATE POLICY "Users read their own subscription"
ON public.subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Aucune policy INSERT/UPDATE/DELETE : seules les Edge Functions,
-- qui utilisent la service key, contournent la RLS et écrivent ici.

-- ------------------------------------------------------------
-- 2. Paiements — trace de chaque achat
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_id text NOT NULL,                 -- premium_15j, premium_1m, premium_3m, vip_1m
  plan_id text NOT NULL CHECK (plan_id IN ('premium', 'vip')),
  days integer NOT NULL,
  amount_xof integer NOT NULL,
  -- Identifiants Chariow
  sale_id text UNIQUE,                    -- sal_… renvoyé par /v1/checkout
  transaction_id text,
  checkout_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS payments_user_status_idx ON public.payments (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_sale_idx ON public.payments (sale_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own payments" ON public.payments;
CREATE POLICY "Users read their own payments"
ON public.payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. Déduplication des webhooks
-- ------------------------------------------------------------
-- La signature Chariow ne contient AUCUN horodatage (choix assumé de leur
-- part) : une requête rejouée reste valide indéfiniment. L'en-tête
-- x-pulse-delivery-id est donc la seule protection contre le rejeu,
-- et cette table la rend effective.
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  delivery_id text PRIMARY KEY,
  event text,
  received_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
-- Aucune policy : table réservée aux Edge Functions.

-- ------------------------------------------------------------
-- 4. Application d'un paiement confirmé
-- ------------------------------------------------------------
-- Prolonge l'abonnement au lieu de l'écraser : acheter pendant une période
-- active ajoute les jours à la date de fin existante.
CREATE OR REPLACE FUNCTION public.apply_subscription_payment(
  p_user_id uuid,
  p_plan_id text,
  p_days integer
)
RETURNS timestamp with time zone AS $$
DECLARE
  v_current timestamp with time zone;
  v_base    timestamp with time zone;
  v_new_end timestamp with time zone;
BEGIN
  SELECT expires_at INTO v_current
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  -- On repart de la fin en cours si elle est future, sinon de maintenant
  v_base := GREATEST(COALESCE(v_current, timezone('utc'::text, now())), timezone('utc'::text, now()));
  v_new_end := v_base + (p_days || ' days')::interval;

  INSERT INTO public.subscriptions (user_id, plan_id, expires_at, started_at, updated_at)
  VALUES (p_user_id, p_plan_id, v_new_end, timezone('utc'::text, now()), timezone('utc'::text, now()))
  ON CONFLICT (user_id) DO UPDATE
    SET plan_id    = EXCLUDED.plan_id,
        expires_at = v_new_end,
        started_at = COALESCE(public.subscriptions.started_at, EXCLUDED.started_at),
        updated_at = timezone('utc'::text, now());

  RETURN v_new_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 5. Temps réel : le statut d'abonnement se met à jour tout seul
-- ------------------------------------------------------------
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 6. Contrôle
-- ------------------------------------------------------------
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('subscriptions', 'payments', 'webhook_deliveries');
