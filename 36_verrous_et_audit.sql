-- ============================================================
-- Rattachement des verrous, et audit complet des accès par offre
-- ============================================================
-- CE QUI S'EST PASSÉ
--
-- Les cinq fonctions d'application des restrictions sont correctes. Mais
-- les TRIGGERS qui les appellent n'étaient créés que dans la migration 26.
-- Les migrations 27 et 33 se contentaient de `CREATE OR REPLACE FUNCTION` :
-- elles réécrivaient la serrure sans jamais vérifier qu'une porte y était
-- rattachée.
--
-- Conséquence : sur une base où la 26 n'est pas passée — ou dont une partie
-- a échoué — les fonctions existent, sont parfaitement écrites, et RIEN ne
-- les appelle. Aucune erreur nulle part. Un compte gratuit publie photos et
-- vidéos comme un VIP.
--
-- C'est ma faute de conception : une migration qui remplace une fonction de
-- trigger doit garantir le trigger, pas le supposer. Celle-ci est donc
-- idempotente et se relance sans risque autant de fois que nécessaire.

-- ------------------------------------------------------------
-- 1. Les cinq verrous, rattachés sans condition
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_message_limits ON public.messages;
CREATE TRIGGER trg_message_limits
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_limits();

DROP TRIGGER IF EXISTS trg_swipe_limits ON public.swipes;
CREATE TRIGGER trg_swipe_limits
BEFORE INSERT ON public.swipes
FOR EACH ROW EXECUTE FUNCTION public.enforce_swipe_limits();

DROP TRIGGER IF EXISTS trg_call_limits ON public.calls;
CREATE TRIGGER trg_call_limits
BEFORE INSERT ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.enforce_call_limits();

DROP TRIGGER IF EXISTS trg_community_media ON public.community_posts;
CREATE TRIGGER trg_community_media
BEFORE INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_community_media();

DROP TRIGGER IF EXISTS trg_visibility_control ON public.profiles;
CREATE TRIGGER trg_visibility_control
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_visibility_control();

-- ------------------------------------------------------------
-- 2. La modification d'une publication contournait tout
-- ------------------------------------------------------------
-- Le trigger ne portait que sur INSERT. Publier un texte seul puis lui
-- ajouter une photo par UPDATE passait sans le moindre contrôle.
DROP TRIGGER IF EXISTS trg_community_media_update ON public.community_posts;
CREATE TRIGGER trg_community_media_update
BEFORE UPDATE ON public.community_posts
FOR EACH ROW
WHEN (NEW.image_url IS DISTINCT FROM OLD.image_url
   OR NEW.video_url IS DISTINCT FROM OLD.video_url)
EXECUTE FUNCTION public.enforce_community_media();

-- Même faille sur les messages : envoyer un texte puis y attacher une
-- vidéo par UPDATE échappait au contrôle du palier.
--
-- Fonction dédiée, et non `enforce_message_limits` : celle-ci recompte le
-- quota quotidien, ce qui refuserait une simple modification à quelqu'un
-- ayant atteint sa limite du jour. Un message déjà envoyé ne doit pas être
-- décompté une seconde fois.
CREATE OR REPLACE FUNCTION public.enforce_message_media_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_level smallint;
BEGIN
  v_level := public.effective_level(NEW.sender_id);

  IF NEW.media_type = 'audio'
     AND v_level < public.setting_int('min_level_voice_message', 1) THEN
    RAISE EXCEPTION 'FREE_NO_VOICE'
      USING HINT = 'Les messages vocaux ne sont pas inclus dans votre formule.';
  END IF;

  IF NEW.media_type = 'video'
     AND v_level < public.setting_int('min_level_video_message', 4) THEN
    RAISE EXCEPTION 'VIP_ONLY_VIDEO_MESSAGE'
      USING HINT = 'L''envoi de vidéos en conversation n''est pas inclus dans votre formule.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_limits_update ON public.messages;
CREATE TRIGGER trg_message_limits_update
BEFORE UPDATE ON public.messages
FOR EACH ROW
WHEN (NEW.media_type IS DISTINCT FROM OLD.media_type)
EXECUTE FUNCTION public.enforce_message_media_on_update();

-- ------------------------------------------------------------
-- 3. AUDIT — à lire ligne par ligne
-- ------------------------------------------------------------

-- 3.1 Les verrous sont-ils en place ?
-- Les 7 lignes doivent apparaître. Une absence = restriction inopérante.
SELECT
  c.relname            AS table_ciblee,
  t.tgname             AS trigger_nom,
  p.proname            AS fonction,
  CASE t.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS moment,
  CASE
    WHEN t.tgtype & 4  = 4  THEN 'INSERT'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
    ELSE 'AUTRE'
  END                  AS evenement,
  t.tgenabled          AS actif   -- 'O' = activé. 'D' = DÉSACTIVÉ.
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc  p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND t.tgname IN ('trg_message_limits', 'trg_message_limits_update',
                   'trg_swipe_limits', 'trg_call_limits',
                   'trg_community_media', 'trg_community_media_update',
                   'trg_visibility_control')
  -- 7 lignes attendues
ORDER BY c.relname, t.tgname;

-- 3.2 Combien de membres échappent aux restrictions ?
-- Un fondateur est traité comme VIP sans avoir payé. Si votre compte de
-- test y figure, c'est LÀ qu'est l'explication, pas dans les triggers :
-- la migration 25 a dû être rejouée après sa création.
SELECT
  count(*) FILTER (WHERE is_founder)       AS fondateurs,
  count(*) FILTER (WHERE NOT is_founder)   AS membres_normaux,
  count(*)                                 AS total
FROM public.profiles;

-- 3.3 Les 10 comptes les plus récents et leur niveau réel
SELECT
  p.first_name,
  p.created_at::date              AS inscrit_le,
  p.is_founder                    AS fondateur,
  public.effective_plan(p.id)     AS formule,
  public.effective_level(p.id)    AS palier,
  public.quota_messages(public.effective_level(p.id)) AS msg_jour,
  public.quota_likes(public.effective_level(p.id))    AS likes_jour
FROM public.profiles p
ORDER BY p.created_at DESC
LIMIT 10;

-- 3.4 Grille des quotas réellement appliquée
SELECT
  lvl                                             AS palier,
  CASE lvl WHEN 0 THEN 'Gratuit' WHEN 1 THEN 'Premium 15j'
           WHEN 2 THEN 'Premium 1m' WHEN 3 THEN 'Premium 3m'
           ELSE 'VIP' END                         AS offre,
  public.quota_messages(lvl::smallint)            AS messages_jour,
  public.quota_likes(lvl::smallint)               AS likes_jour,
  public.quota_superlikes(lvl::smallint)          AS superlikes_jour,
  public.superlike_cooldown(lvl::smallint)        AS delai_superlike_j,
  public.quota_boosts(lvl::smallint)              AS boosts_mois
FROM generate_series(0, 4) AS lvl
ORDER BY lvl;

-- 3.5 Paliers minimum par fonctionnalité
SELECT key, value FROM public.app_settings
WHERE key LIKE 'min_level_%' ORDER BY key;

-- 3.6 Les fonctions sensibles sont-elles hors de portée du client ?
-- `effective_plan` et `effective_level` prennent un user_id : accessibles
-- au rôle `authenticated`, n'importe qui interrogerait le statut d'autrui.
-- Aucune ligne ne doit sortir.
SELECT
  p.proname                                   AS fonction,
  pg_get_userbyid(p.proowner)                 AS proprietaire,
  array_to_string(p.proacl, ', ')             AS droits
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('effective_plan', 'effective_level',
                    'apply_subscription_payment', 'can_send_email')
  AND (
    array_to_string(p.proacl, ',') LIKE '%authenticated=X%'
    OR array_to_string(p.proacl, ',') LIKE '%anon=X%'
  );

-- 3.7 Publications médias par des comptes non autorisés
-- Ce que les verrous manquants ont laissé passer. Une liste vide est le
-- résultat attendu ; sinon, ces publications ont été créées sans droit.
SELECT
  cp.id,
  pr.first_name,
  public.effective_level(cp.user_id)  AS palier_auteur,
  CASE WHEN COALESCE(cp.video_url, '') <> '' THEN 'vidéo' ELSE 'photo' END AS media,
  cp.created_at
FROM public.community_posts cp
JOIN public.profiles pr ON pr.id = cp.user_id
WHERE (
    COALESCE(cp.image_url, '') <> ''
    AND public.effective_level(cp.user_id) < public.setting_int('min_level_post_image', 1)
  ) OR (
    COALESCE(cp.video_url, '') <> ''
    AND public.effective_level(cp.user_id) < public.setting_int('min_level_post_video', 4)
  )
ORDER BY cp.created_at DESC;

-- 3.8 Dépassements de quota déjà enregistrés
-- Nombre de membres ayant dépassé aujourd'hui leur quota de messages.
SELECT
  pr.first_name,
  public.effective_level(m.sender_id)                        AS palier,
  count(*)                                                   AS envoyes_aujourdhui,
  public.quota_messages(public.effective_level(m.sender_id)) AS quota
FROM public.messages m
JOIN public.profiles pr ON pr.id = m.sender_id
WHERE m.created_at >= date_trunc('day', timezone('utc'::text, now()))
GROUP BY pr.first_name, m.sender_id
HAVING public.quota_messages(public.effective_level(m.sender_id)) <> -1
   AND count(*) > public.quota_messages(public.effective_level(m.sender_id))
ORDER BY count(*) DESC;
