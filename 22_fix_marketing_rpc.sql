-- ============================================================
-- 22_fix_marketing_rpc.sql
-- Corrige l'erreur "column user_id does not exist" dans admin_marketing
-- (swipes a "actor_id" et matches a "user1_id" et "user2_id")
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_marketing(INT);

CREATE OR REPLACE FUNCTION public.admin_marketing(p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  since TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
  v_total INT;
  v_payants INT;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT COUNT(*) INTO v_total FROM public.profiles;
  SELECT COUNT(DISTINCT user_id) INTO v_payants FROM public.payments WHERE status = 'completed';
  RETURN jsonb_build_object(
    'periode_jours', p_days,
    'portee', jsonb_build_object(
      'membres', v_total,
      'email', v_total,
      'push', 0,
      'joignables', v_total,
      'taux', 100
    ),
    'acquisition', '[]'::jsonb,
    'entonnoir', jsonb_build_object(
      'inscrits', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since),
      'photo', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= since AND array_length(photos,1) > 0),
      'swipe', (SELECT COUNT(DISTINCT actor_id) FROM public.swipes WHERE created_at >= since),
      'match', (SELECT COUNT(DISTINCT user1_id) FROM public.matches WHERE created_at >= since),
      'message', (SELECT COUNT(DISTINCT sender_id) FROM public.messages WHERE created_at >= since),
      'payant', (SELECT COUNT(DISTINCT user_id) FROM public.payments WHERE status = 'completed' AND created_at >= since)
    ),
    'segments', '[]'::jsonb,
    'campagnes', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.campaigns),
      'periode', (SELECT COUNT(*) FROM public.campaigns WHERE created_at >= since),
      'destinataires', 0,
      'delivres', 0,
      'ignores', 0
    ),
    'delivrabilite', jsonb_build_object(
      'supprimes', 0, 'rebonds', 0, 'plaintes', 0, 'envois_30j', 0, 'taux_plainte', 0
    ),
    'revenus', jsonb_build_object(
      'periode', COALESCE((SELECT SUM(amount_xof) FROM public.payments WHERE status='completed' AND completed_at >= since), 0),
      'total', COALESCE((SELECT SUM(amount_xof) FROM public.payments WHERE status='completed'), 0),
      'payants', v_payants,
      'panier', CASE WHEN v_payants > 0 THEN COALESCE((SELECT AVG(amount_xof) FROM public.payments WHERE status='completed'), 0) ELSE 0 END
    )
  );
END;
$$;
