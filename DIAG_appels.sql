-- Diagnostic « Impossible de lancer l'appel »
-- Remplacez l'adresse, sélectionnez tout, Ctrl+Entrée.

SELECT
  u.email,
  public.effective_plan(p.id)   AS plan_vu_par_la_base,
  public.effective_level(p.id)  AS niveau,
  p.public_plan                 AS plan_affiche,
  p.is_founder,
  (SELECT count(*) FROM public.subscriptions s
    WHERE s.user_id = p.id AND s.expires_at > now())      AS abonnements_valides,
  (SELECT count(*) FROM pg_trigger
    WHERE tgrelid = 'public.calls'::regclass
      AND tgname = 'trg_call_limits')                     AS trigger_actif,
  CASE
    WHEN public.effective_level(p.id) >= 4 THEN 'audio OK + video OK'
    WHEN public.effective_level(p.id) >= 1 THEN 'audio OK, video REFUSEE'
    ELSE 'TOUT REFUSE — compte au niveau gratuit'
  END AS verdict
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'biznessplace21@gmail.com';
