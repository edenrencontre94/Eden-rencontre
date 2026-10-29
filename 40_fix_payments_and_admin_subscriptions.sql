-- ==============================================================================
-- 40_fix_payments_and_admin_subscriptions.sql
-- Correction de la table payments, RLS admin et RPC admin_get_payments
-- ==============================================================================

-- 1. S'assurer que la table payments existe avec toutes les colonnes requises
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_xof NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'XOF';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS offer_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'premium';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS chariow_order_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Contrainte d'unicité sur chariow_order_id pour éviter les doublons lors des re-tentatives webhook
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_payments_chariow_order_id'
    ) THEN
        ALTER TABLE public.payments ADD CONSTRAINT uq_payments_chariow_order_id UNIQUE (chariow_order_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. Index pour performances
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_chariow_order_id ON public.payments(chariow_order_id);

-- 3. Activer RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS sans blocage pour les administrateurs
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins have full access on payments" ON public.payments;
CREATE POLICY "Admins have full access on payments"
    ON public.payments
    FOR ALL
    TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- 5. RPC dédiée pour l'administration : admin_get_payments
-- Permet à l'écran /admin/abonnements de récupérer tous les paiements avec les noms des membres,
-- même si les politiques directes RLS sont strictes (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.admin_get_payments(p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payments JSONB;
  v_active_subs JSONB;
BEGIN
  -- Vérifier le rôle staff / admin
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  -- Liste des paiements récents avec prénom de l'utilisateur
  SELECT jsonb_agg(row_to_json(p_row))
  INTO v_payments
  FROM (
    SELECT 
      pay.id,
      pay.user_id,
      COALESCE(prof.first_name, 'Membre') AS user_name,
      pay.offer_id,
      pay.plan_id,
      pay.amount_xof,
      pay.status,
      pay.chariow_order_id,
      pay.created_at,
      pay.completed_at
    FROM public.payments pay
    LEFT JOIN public.profiles prof ON prof.id = pay.user_id
    ORDER BY pay.created_at DESC
    LIMIT p_limit
  ) p_row;

  -- Abonnements actifs actuels
  SELECT jsonb_agg(row_to_json(s_row))
  INTO v_active_subs
  FROM (
    SELECT 
      id,
      first_name,
      public_plan,
      premium_until
    FROM public.profiles
    WHERE premium_until > now()
  ) s_row;

  RETURN jsonb_build_object(
    'payments', COALESCE(v_payments, '[]'::jsonb),
    'active_subs', COALESCE(v_active_subs, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payments(INT) TO authenticated;
GRANT ALL ON public.payments TO service_role;
