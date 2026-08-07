-- ============================================================
-- Diagnostic : « Impossible de lancer l'appel »
-- ============================================================
-- À exécuter dans l'éditeur SQL Supabase.
--
-- Remplacez l'adresse ci-dessous par celle du compte qui échoue, puis
-- exécutez les blocs UN PAR UN (sélectionnez le bloc, Ctrl+Entrée) :
-- l'éditeur n'affiche que le résultat de la dernière requête quand on
-- lance tout d'un coup.
--
--   >>> ADRESSE À REMPLACER : 'biznessplace21@gmail.com'  <<<

-- ------------------------------------------------------------
-- 1. Ce que la base pense de ce compte
-- ------------------------------------------------------------
-- `enforce_call_limits` compare `effective_level` aux seuils. Si le
-- niveau est inférieur, l'INSERT est refusé — quoi qu'affiche l'interface.
SELECT
  u.email,
  p.id,
  p.is_founder,
  p.public_plan,
  p.premium_until,
  public.effective_plan(p.id)   AS plan_reel,
  public.effective_level(p.id)  AS niveau_reel,
  public.setting_int('min_level_audio_call', 1) AS seuil_audio,
  public.setting_int('min_level_video_call', 4) AS seuil_video,
  CASE WHEN public.effective_level(p.id)
            >= public.setting_int('min_level_audio_call', 1)
       THEN 'AUTORISE' ELSE 'REFUSE' END        AS appel_audio,
  CASE WHEN public.effective_level(p.id)
            >= public.setting_int('min_level_video_call', 4)
       THEN 'AUTORISE' ELSE 'REFUSE' END        AS appel_video
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'biznessplace21@gmail.com';


-- ------------------------------------------------------------
-- 2. L'abonnement enregistré
-- ------------------------------------------------------------
-- `effective_plan` ne lit QUE cette table, et seulement les lignes dont
-- `expires_at` est dans le futur. Un paiement encaissé sans ligne ici, ou
-- avec une date dépassée, ramène le compte au niveau 0.
--
-- Zéro ligne renvoyée est un résultat en soi : c'est la réponse.
SELECT s.plan_id, s.premium_level, s.expires_at,
       s.expires_at > now() AS encore_valide
FROM public.subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE u.email = 'biznessplace21@gmail.com'
ORDER BY s.expires_at DESC;


-- ------------------------------------------------------------
-- 3. Le compte est-il suspendu ?
-- ------------------------------------------------------------
-- `block_if_suspended` (migration 45) refuse tout INSERT dans `calls`.
-- Si la migration 45 n'a pas été exécutée, cette requête échoue sur
-- `suspended_until` — c'est normal, passez à la suivante.
SELECT p.suspended_until, public.is_suspended(p.id) AS suspendu
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'biznessplace21@gmail.com';


-- ------------------------------------------------------------
-- 4. Quels déclencheurs sont réellement actifs sur `calls`
-- ------------------------------------------------------------
-- LA REQUÊTE DÉCISIVE. La migration 36 a (r)attaché `trg_call_limits`.
-- S'il apparaît ici alors que les appels marchaient avant, c'est lui : la
-- règle existait dans le code depuis longtemps, mais rien ne l'appliquait.
SELECT tgname AS declencheur,
       CASE tgenabled WHEN 'O' THEN 'actif' ELSE 'desactive' END AS etat
FROM pg_trigger
WHERE tgrelid = 'public.calls'::regclass
  AND NOT tgisinternal
ORDER BY tgname;


-- ------------------------------------------------------------
-- 5. Les seuils configurés
-- ------------------------------------------------------------
-- Modifiables depuis /admin/parametres. Un seuil audio à 2 ou 3
-- exclurait les Premium d'entrée de gamme.
SELECT key, value FROM public.app_settings
WHERE key IN ('min_level_audio_call', 'min_level_video_call');


-- ------------------------------------------------------------
-- 6. La politique RLS d'insertion
-- ------------------------------------------------------------
-- Si aucune ligne `INSERT` n'apparaît, la table est verrouillée pour tout
-- le monde et l'erreur sera « 42501 », pas un code de quota.
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'calls'
ORDER BY cmd, policyname;
