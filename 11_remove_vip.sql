-- ══════════════════════════════════════════════════════════════════════════════
-- 11_remove_vip.sql
-- Supprime toute trace du palier VIP de la base de données.
--
-- Contexte : le plan "vip" a été fusionné avec "premium". Toutes les
-- fonctionnalités anciennement réservées aux VIP sont désormais accessibles
-- à tous les membres Premium. Les membres fondateurs (is_founder = true)
-- conservent leur accès Premium à vie.
--
-- NOTE : dans ce projet, l'abonnement est stocké DIRECTEMENT dans la table
-- `profiles` (colonnes public_plan et premium_until). Il n'y a pas de table
-- `subscriptions` séparée.
--
-- À exécuter UNE SEULE FOIS dans le SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. app_settings : correction du palier vidéo ─────────────────────────────
-- L'ancien réglage plaçait la vidéo au niveau "vip" (chaîne).
-- On le remplace par le niveau numérique 1 (= toute formule Premium).

UPDATE public.app_settings
SET value = '1'::jsonb
WHERE key = 'min_level_post_video'
  AND value = '"vip"'::jsonb;

-- Correction défensive pour les autres gates vidéo si elles avaient été
-- configurées manuellement sur "vip" depuis /admin/parametres.
UPDATE public.app_settings
SET value = '1'::jsonb
WHERE key IN ('min_level_video_call', 'min_level_video_message')
  AND value = '"vip"'::jsonb;

-- ─── 2. profiles : migrer les membres avec public_plan = 'vip' → 'premium' ────
-- La date d'expiration (premium_until) est conservée intacte.
-- Les fondateurs (is_founder = true) bénéficient déjà d'un accès à vie
-- via la logique applicative ; public_plan = 'vip' peut aussi être corrigé.

UPDATE public.profiles
SET public_plan = 'premium'
WHERE public_plan = 'vip';

-- ─── 3. payments : historique conservé tel quel ───────────────────────────────
-- Les lignes offer_id = 'vip_1m' restent intactes pour l'audit financier.
-- Elles sont ignorées côté front (OFFER_LABELS n'a plus cette entrée).

-- ─── 4. Vérification post-migration ──────────────────────────────────────────
-- Exécuter ces requêtes pour vérifier le résultat :

-- SELECT key, value FROM public.app_settings
-- WHERE key LIKE 'min_level%' ORDER BY key;
-- → Aucune valeur ne doit contenir "vip".

-- SELECT COUNT(*) FROM public.profiles WHERE public_plan = 'vip';
-- → Doit retourner 0.

-- ─── 5. Identifier les triggers VIP restants ─────────────────────────────────
-- Chercher les fonctions qui utilisent encore le code VIP_ONLY :

SELECT routine_name, LEFT(routine_definition, 300) AS extrait
FROM information_schema.routines
WHERE routine_definition ILIKE '%VIP_ONLY%'
  AND routine_schema = 'public';

-- Si des résultats apparaissent, recréer ces fonctions en remplaçant :
--   RAISE EXCEPTION 'VIP_ONLY_VIDEO_CALL'    →  'PREMIUM_ONLY_VIDEO_CALL'
--   RAISE EXCEPTION 'VIP_ONLY_VIDEO_MESSAGE' →  'PREMIUM_ONLY_VIDEO_MESSAGE'
--   RAISE EXCEPTION 'VIP_ONLY_VIDEO_POST'    →  'PREMIUM_ONLY_VIDEO_POST'
-- et en changeant la condition :
--   plan_id = 'vip'    →  public_plan = 'premium'
-- (ajouter OR is_founder = true pour que les fondateurs passent aussi).
