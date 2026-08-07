-- ============================================================
-- Conversations — accès complet pour la modération
-- ============================================================
-- Décision d'exploitant : la modération accède à TOUTES les conversations,
-- pas seulement à celles faisant l'objet d'un signalement.
--
-- La migration 47 restreignait l'accès au périmètre annoncé dans la
-- politique de confidentialité. Cette restriction est levée ici, et la
-- politique publiée est mise à jour en conséquence dans le même lot —
-- une pratique qui contredit ses propres engagements écrits est le seul
-- vrai risque, bien plus que la pratique elle-même.
--
-- CE QUI EST CONSERVÉ, ET POURQUOI :
--
--   • Le MOTIF reste obligatoire. Non pour freiner, mais parce qu'un
--     journal sans motif ne se relit pas : « conversation ouverte » six
--     mois plus tard n'apprend rien à personne.
--
--   • Le JOURNAL reste systématique. C'est ce qui permet de répondre à un
--     membre qui demande « qui a lu mes messages ? » — question à laquelle
--     tout exploitant finit par être confronté, et à laquelle « je ne sais
--     pas » est la pire réponse possible.

-- ------------------------------------------------------------
-- 1. Liste des conversations
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_conversations(
  p_filter text    DEFAULT 'all',      -- 'all' | 'flagged' | 'active'
  p_search text    DEFAULT NULL,       -- prénom, nom ou ville d'un participant
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_q   text := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'total',   (SELECT count(*) FROM public.matches),
    'signalees', (
      SELECT count(*) FROM public.matches mt
      WHERE EXISTS (SELECT 1 FROM public.reports r
                    WHERE r.status = 'pending'
                      AND r.reported_id IN (mt.user1_id, mt.user2_id))
    ),
    'conversations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'match_id', c.id,
        'user1', jsonb_build_object(
          'id', a.id, 'nom', COALESCE(a.first_name, 'Membre'),
          'photo', CASE WHEN a.photos IS NOT NULL AND array_length(a.photos, 1) > 0
                        THEN a.photos[1] ELSE NULL END),
        'user2', jsonb_build_object(
          'id', b.id, 'nom', COALESCE(b.first_name, 'Membre'),
          'photo', CASE WHEN b.photos IS NOT NULL AND array_length(b.photos, 1) > 0
                        THEN b.photos[1] ELSE NULL END),
        'nb_messages', c.nb,
        'dernier', c.dernier,
        'created_at', c.created_at,
        'signalee', c.signalee,
        'motif', c.motif,
        -- Nombre de fois où cette conversation a déjà été consultée.
        -- Affiché en clair : une conversation lue dix fois sans motif
        -- sérieux doit se remarquer, y compris par vous.
        'consultations', (SELECT count(*) FROM public.admin_access_log l
                          WHERE l.match_id = c.id)
      ) ORDER BY c.dernier DESC NULLS LAST)
      FROM (
        SELECT
          mt.id, mt.user1_id, mt.user2_id, mt.created_at,
          (SELECT count(*) FROM public.messages m WHERE m.match_id = mt.id) AS nb,
          (SELECT max(m.created_at) FROM public.messages m WHERE m.match_id = mt.id) AS dernier,
          EXISTS (SELECT 1 FROM public.reports r
                  WHERE r.status = 'pending'
                    AND r.reported_id IN (mt.user1_id, mt.user2_id)) AS signalee,
          (SELECT string_agg(DISTINCT r.reason, ', ')
           FROM public.reports r
           WHERE r.status = 'pending'
             AND r.reported_id IN (mt.user1_id, mt.user2_id)) AS motif
        FROM public.matches mt
        WHERE (
          p_filter = 'all'
          OR (p_filter = 'flagged' AND EXISTS (
                SELECT 1 FROM public.reports r
                WHERE r.status = 'pending'
                  AND r.reported_id IN (mt.user1_id, mt.user2_id)))
          -- « Actives » : celles qui ont au moins un message. Une
          -- conversation vide n'a rien à modérer et noie les autres.
          OR (p_filter = 'active' AND EXISTS (
                SELECT 1 FROM public.messages m WHERE m.match_id = mt.id))
        )
        AND (
          v_q IS NULL
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id IN (mt.user1_id, mt.user2_id)
              AND (p.first_name ILIKE '%' || v_q || '%'
                OR p.last_name  ILIKE '%' || v_q || '%'
                OR p.city       ILIKE '%' || v_q || '%')
          )
        )
        ORDER BY (SELECT max(m.created_at) FROM public.messages m WHERE m.match_id = mt.id)
                 DESC NULLS LAST
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
        OFFSET GREATEST(0, COALESCE(p_offset, 0))
      ) c
      LEFT JOIN public.profiles a ON a.id = c.user1_id
      LEFT JOIN public.profiles b ON b.id = c.user2_id
    ), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------
-- 2. Lecture — plus de restriction de périmètre
-- ------------------------------------------------------------
-- Le contrôle qui limitait aux conversations signalées est retiré. Le
-- motif et le journal, eux, restent.
CREATE OR REPLACE FUNCTION public.admin_read_conversation(
  p_match_id uuid,
  p_motif text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existe boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF length(trim(COALESCE(p_motif, ''))) < 5 THEN
    RETURN jsonb_build_object('error', 'motif_requis');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.matches WHERE id = p_match_id) INTO v_existe;
  IF NOT v_existe THEN
    RETURN jsonb_build_object('error', 'introuvable');
  END IF;

  INSERT INTO public.admin_access_log (admin_id, match_id, motif)
  VALUES (auth.uid(), p_match_id, trim(p_motif));

  RETURN jsonb_build_object(
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'sender_id', m.sender_id,
        'auteur', COALESCE(p.first_name, 'Membre'),
        'content', m.content, 'media_type', m.media_type,
        'read_at', m.read_at,
        'created_at', m.created_at
      ) ORDER BY m.created_at ASC)
      FROM public.messages m
      LEFT JOIN public.profiles p ON p.id = m.sender_id
      WHERE m.match_id = p_match_id
    ), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------
-- 3. Le journal, consultable
-- ------------------------------------------------------------
-- Un journal que personne ne peut lire ne sert à rien. Celui-ci répond à
-- deux questions : qui a consulté quoi, et pour quel motif.
CREATE OR REPLACE FUNCTION public.admin_access_history(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'total',    (SELECT count(*) FROM public.admin_access_log),
    'total_30j',(SELECT count(*) FROM public.admin_access_log
                 WHERE created_at >= timezone('utc'::text, now()) - interval '30 days'),
    'acces', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'admin', COALESCE(ad.first_name, 'Administrateur supprimé'),
        'motif', l.motif,
        'created_at', l.created_at,
        'match_id', l.match_id,
        'participants', (
          SELECT COALESCE(a.first_name, '?') || ' ↔ ' || COALESCE(b.first_name, '?')
          FROM public.matches mt
          LEFT JOIN public.profiles a ON a.id = mt.user1_id
          LEFT JOIN public.profiles b ON b.id = mt.user2_id
          WHERE mt.id = l.match_id
        )
      ) ORDER BY l.created_at DESC)
      FROM (
        SELECT * FROM public.admin_access_log
        ORDER BY created_at DESC
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
      ) l
      LEFT JOIN public.profiles ad ON ad.id = l.admin_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_conversations(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_conversations(text, text, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_access_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_access_history(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 4. Contrôle
-- ------------------------------------------------------------
SELECT public.admin_conversations('all', NULL, 5, 0) AS conversations;
SELECT public.admin_access_history(10) AS journal;
