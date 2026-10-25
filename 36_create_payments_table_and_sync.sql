-- ==============================================================================
-- 36_create_payments_table_and_sync.sql
-- Migration / Complétion de la table `payments` + RLS + Droits Admin + Index
-- Compatible si la table existe déjà avec une ancienne structure
-- ==============================================================================

-- 1. Création de base si la table n'existe pas encore
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ajout sécurisé de toutes les colonnes requises
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

-- Synchronisation si amount existe mais amount_xof est vide
UPDATE public.payments 
SET amount_xof = amount 
WHERE (amount_xof IS NULL OR amount_xof = 0) AND amount IS NOT NULL;

-- 3. Index pour performances
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_chariow_order_id ON public.payments(chariow_order_id);

-- 4. Activation de RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
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

-- 6. Permissions de rôles
GRANT ALL ON public.payments TO service_role;
GRANT SELECT, INSERT ON public.payments TO authenticated;
