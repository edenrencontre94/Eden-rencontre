-- ============================================================
-- Archivage des conversations, et blocage réellement appliqué
-- ============================================================
-- DEUX PROBLÈMES DISTINCTS
--
-- 1. « Archiver » n'existait pas. Le menu affichait « Conversation
--    archivée » et ne faisait rien d'autre : aucune table, aucune
--    colonne, aucun appel. Un message de succès pour une action qui
--    n'a jamais eu lieu.
--
-- 2. « Bloquer » écrivait bien dans `blocks`, et `discover_profiles`
--    (migration 45) en tenait compte — la personne bloquée disparaît
--    bien de la découverte. Mais RIEN n'empêchait ses messages ni ses
--    appels d'arriver : aucun trigger sur `messages`, aucun sur `calls`.
--    Le blocage masquait la conversation chez celui qui bloque, sans
--    jamais couper le canal. Sur une application de rencontre, bloquer
--    quelqu'un pour comportement déplacé doit lui retirer l'accès, pas
--    seulement le cacher.

-- ------------------------------------------------------------
-- 1. Conversations archivées
-- ------------------------------------------------------------
-- Propre à chaque membre : archiver de son côté ne doit rien changer
-- pour l'autre, qui n'a aucune raison de l'apprendre.
CREATE TABLE IF NOT EXISTS public.archived_chats (
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id    uuid NOT NULL REFERENCES public.matches(id)  ON DELETE CASCADE,
  archived_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS archived_chats_user_idx
  ON public.archived_chats (user_id);

ALTER TABLE public.archived_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chacun voit ses archives" ON public.archived_chats;
CREATE POLICY "Chacun voit ses archives"
ON public.archived_chats FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- On n'archive que ses propres conversations, et seulement celles
-- auxquelles on participe : sans ce contrôle, n'importe qui pourrait
-- semer des lignes pour des matches qui ne le concernent pas.
DROP POLICY IF EXISTS "Archiver une conversation" ON public.archived_chats;
CREATE POLICY "Archiver une conversation"
ON public.archived_chats FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Désarchiver une conversation" ON public.archived_chats;
CREATE POLICY "Désarchiver une conversation"
ON public.archived_chats FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. Un nouveau message désarchive
-- ------------------------------------------------------------
-- Sans cela, une conversation archivée puis relancée resterait invisible :
-- le membre ne verrait jamais la réponse qu'il attend. L'archivage range,
-- il ne fait pas taire — c'est le rôle du blocage.
--
-- Seul le DESTINATAIRE est désarchivé. Écrire soi-même dans une
-- conversation qu'on a rangée ne doit pas la remonter chez soi.
CREATE OR REPLACE FUNCTION public.unarchive_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.archived_chats a
  WHERE a.match_id = NEW.match_id
    AND a.user_id <> NEW.sender_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unarchive_on_message ON public.messages;
CREATE TRIGGER trg_unarchive_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.unarchive_on_message();

-- ------------------------------------------------------------
-- 3. Le blocage coupe réellement le canal
-- ------------------------------------------------------------
-- Dans LES DEUX SENS. Si A bloque B, ni A ni B ne peuvent plus écrire :
-- laisser A continuer à écrire à quelqu'un qu'il a bloqué — et dont il
-- ne verra jamais les réponses — n'aurait aucun sens.
CREATE OR REPLACE FUNCTION public.blocage_entre(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

-- Le destinataire se déduit du match : la table `messages` ne porte que
-- l'expéditeur.
CREATE OR REPLACE FUNCTION public.block_message_if_blocked()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_autre uuid;
BEGIN
  SELECT CASE WHEN m.user1_id = NEW.sender_id THEN m.user2_id ELSE m.user1_id END
    INTO v_autre
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF v_autre IS NOT NULL AND public.blocage_entre(NEW.sender_id, v_autre) THEN
    RAISE EXCEPTION 'CONVERSATION_BLOCKED'
      USING HINT = 'Cette conversation est fermée.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_messages ON public.messages;
CREATE TRIGGER trg_block_messages
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.block_message_if_blocked();

-- Sur `calls`, les deux identifiants sont présents : pas besoin du match.
CREATE OR REPLACE FUNCTION public.block_call_if_blocked()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.blocage_entre(NEW.caller_id, NEW.callee_id) THEN
    RAISE EXCEPTION 'CONVERSATION_BLOCKED'
      USING HINT = 'Cette conversation est fermée.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_calls ON public.calls;
CREATE TRIGGER trg_block_calls
BEFORE INSERT ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.block_call_if_blocked();

-- ------------------------------------------------------------
-- 4. Vérification
-- ------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tab, t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal
      AND t.tgname IN ('trg_block_messages', 'trg_block_calls',
                       'trg_unarchive_on_message')
    ORDER BY c.relname, t.tgname
  LOOP
    RAISE NOTICE 'attaché : % sur %', r.tgname, r.tab;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'archived_chats') AS table_archives,
  (SELECT count(*) FROM pg_trigger
    WHERE tgname IN ('trg_block_messages','trg_block_calls','trg_unarchive_on_message'))
    AS triggers_poses;
