-- ============================================================
-- Performance : le dernier message de chaque conversation
-- ============================================================
-- CE QUI SE PASSAIT
--
-- La liste des conversations récupérait le dernier message avec UNE
-- REQUÊTE PAR CONVERSATION :
--
--   Promise.all(matches.map(m =>
--     supabase.from("messages").select(...).eq("match_id", m.id).limit(1)
--   ))
--
-- Trente conversations produisaient trente requêtes HTTP, chacune avec
-- sa latence propre. Sur un réseau mobile ouest-africain à 300 ms
-- d'aller-retour, la liste mettait plusieurs secondes à s'afficher —
-- alors même que le volume de données transféré est dérisoire.
--
-- `DISTINCT ON` fait la même chose en une seule requête, du côté où les
-- données se trouvent déjà.
--
-- AJOUT PUR : une fonction et un index. Rien n'est modifié ni supprimé.
-- Le client conserve son ancien chemin en repli si la fonction est
-- absente — cette migration peut donc être exécutée avant OU après le
-- déploiement, sans fenêtre de casse.

-- ------------------------------------------------------------
-- 1. Index de soutien
-- ------------------------------------------------------------
-- `DISTINCT ON (match_id) ... ORDER BY match_id, created_at DESC` lit
-- l'index dans l'ordre exact et s'arrête à la première ligne de chaque
-- conversation. Sans lui, PostgreSQL trierait toute la table à chaque
-- ouverture de la messagerie.
CREATE INDEX IF NOT EXISTS messages_match_recent_idx
  ON public.messages (match_id, created_at DESC);

-- ------------------------------------------------------------
-- 2. Le dernier message de chacune de MES conversations
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_last_messages()
RETURNS TABLE (
  match_id   uuid,
  content    text,
  media_type text,
  sender_id  uuid,
  created_at timestamp with time zone,
  read_at    timestamp with time zone
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (m.match_id)
         m.match_id, m.content, m.media_type, m.sender_id, m.created_at, m.read_at
  FROM public.messages m
  JOIN public.matches ma ON ma.id = m.match_id
  -- `auth.uid()` est lu ICI, pas transmis par le client : impossible de
  -- demander les conversations de quelqu'un d'autre.
  WHERE ma.user1_id = auth.uid() OR ma.user2_id = auth.uid()
  ORDER BY m.match_id, m.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.my_last_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_last_messages() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Contrôle : exécuté depuis l'éditeur SQL, `auth.uid()` est NULL et le
-- résultat est donc vide. C'est normal.
SELECT count(*) AS lignes FROM public.my_last_messages();
