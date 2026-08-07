-- ============================================================
-- Consultation invisible pour le membre
-- ============================================================
-- Une modération qui s'annonce ne modère rien : quelqu'un qui se sait
-- observé se comporte autrement, ce qui vide de son sens toute enquête sur
-- un harcèlement ou une escroquerie.
--
-- Vérification faite, la lecture d'une conversation par le back-office ne
-- laissait DÉJÀ aucune trace côté membre :
--
--   • `admin_read_conversation` ne fait que des SELECT — `read_at` n'est
--     jamais touché, aucun accusé de lecture n'apparaît.
--   • `admin_access_log` n'est pas dans la publication temps réel, et sa
--     politique RLS la réserve aux administrateurs.
--   • Le membre s'abonne à `messages` et `calls` ; ni l'une ni l'autre
--     n'est écrite lors d'une consultation.
--
-- Cette migration verrouille ces garanties et corrige LA SEULE VRAIE
-- BRÈCHE, qui ne venait pas du back-office.

-- ------------------------------------------------------------
-- 1. La brèche : les visites de profil
-- ------------------------------------------------------------
-- Consulter le profil d'un membre DEPUIS L'APPLICATION enregistre une
-- visite, que l'intéressé voit dans « Visiteurs ». Enquêter sur un profil
-- signalé revenait donc à prévenir la personne visée.
--
-- Les administrateurs sont désormais écartés de ce journal. Le trigger
-- laisse l'insertion se faire sans erreur — la renvoyer ferait apparaître
-- un message dans l'interface, ce qui trahirait tout autant.
CREATE OR REPLACE FUNCTION public.skip_admin_visit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NULL;   -- l'insertion est abandonnée, silencieusement
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_skip_admin_visit ON public.profile_visits;
CREATE TRIGGER trg_skip_admin_visit
BEFORE INSERT ON public.profile_visits
FOR EACH ROW EXECUTE FUNCTION public.skip_admin_visit();

-- ------------------------------------------------------------
-- 2. Le journal reste hors de portée des membres
-- ------------------------------------------------------------
-- La politique RLS suffit déjà. Ces révocations agissent au niveau des
-- privilèges de table : même si quelqu'un désactivait RLS par erreur un
-- jour, la lecture resterait refusée.
REVOKE ALL ON TABLE public.admin_access_log FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_access_log FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_access_log FROM authenticated;

-- La fonction reste SECURITY DEFINER : c'est elle qui écrit, pas le client.
GRANT SELECT, INSERT ON TABLE public.admin_access_log TO service_role;

-- Retrait de la publication temps réel si elle y avait été ajoutée : un
-- membre abonné à tout le schéma verrait passer les consultations en
-- direct, ce qui est précisément ce qu'on veut éviter.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'admin_access_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_access_log;
  END IF;
END $$;

COMMENT ON TABLE public.admin_access_log IS
  'Journal des consultations de conversations par la modération. '
  'Jamais exposé aux membres, jamais publié en temps réel. '
  'Toute évolution doit préserver ces deux propriétés.';

-- ------------------------------------------------------------
-- 3. Garantie sur les accusés de lecture
-- ------------------------------------------------------------
-- Rien dans le chemin de lecture ne modifie `read_at` aujourd'hui. Ce
-- commentaire existe pour que cela reste vrai : marquer les messages
-- comme lus lors d'une consultation ferait apparaître les deux coches
-- bleues côté membre, sans qu'il ait ouvert quoi que ce soit.
COMMENT ON COLUMN public.messages.read_at IS
  'Posé UNIQUEMENT par le destinataire lorsqu''il ouvre la conversation. '
  'La modération ne doit jamais l''écrire : cela afficherait un accusé de '
  'lecture que le destinataire n''a pas produit.';

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 4. Contrôle
-- ------------------------------------------------------------
-- Aucune ligne ne doit sortir : le journal n'est pas en temps réel.
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'admin_access_log';

-- Privilèges sur le journal : `authenticated` ne doit pas y figurer.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'admin_access_log'
ORDER BY grantee;

-- Le trigger anti-visite est-il en place ?
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.profile_visits'::regclass AND NOT tgisinternal;
