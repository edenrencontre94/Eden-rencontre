-- ============================================================
-- Analytics et Support
-- ============================================================
-- Deux ajouts au back-office :
--
-- ANALYTICS — des séries temporelles et un entonnoir de conversion, calculés
-- en base. Une seule fonction plutôt que quinze requêtes depuis le
-- navigateur : la page se charge d'un coup et les règles d'agrégation
-- restent au même endroit.
--
-- SUPPORT — une vraie billetterie. L'application n'offrait AUCUN moyen de
-- joindre l'équipe : ni page d'aide, ni formulaire de contact. Un membre
-- dont le paiement échoue n'avait d'autre recours que de partir.

-- ------------------------------------------------------------
-- 1. Analytics
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date;
  v_to   date;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Bornes raisonnables : au-delà d'un an les séries deviennent illisibles
  -- et la requête coûteuse pour rien.
  p_days := GREATEST(7, LEAST(COALESCE(p_days, 30), 365));
  v_to   := (timezone('utc'::text, now()))::date;
  v_from := v_to - p_days + 1;

  RETURN jsonb_build_object(
    'range_days', p_days,
    'from', v_from,
    'to', v_to,

    -- ── Séries quotidiennes ────────────────────────────────
    -- La série de dates est générée d'abord, puis jointe aux comptages :
    -- sans cela, un jour sans inscription disparaîtrait du graphique et
    -- la courbe mentirait sur le rythme réel.
    'signups', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('d', g.d, 'n', COALESCE(c.n, 0)) ORDER BY g.d), '[]'::jsonb)
      FROM generate_series(v_from, v_to, '1 day'::interval) AS g(d)
      LEFT JOIN (
        SELECT created_at::date AS dd, count(*) AS n
        FROM public.profiles WHERE created_at::date >= v_from GROUP BY 1
      ) c ON c.dd = g.d::date
    ),

    'matches', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('d', g.d, 'n', COALESCE(c.n, 0)) ORDER BY g.d), '[]'::jsonb)
      FROM generate_series(v_from, v_to, '1 day'::interval) AS g(d)
      LEFT JOIN (
        SELECT created_at::date AS dd, count(*) AS n
        FROM public.matches WHERE created_at::date >= v_from GROUP BY 1
      ) c ON c.dd = g.d::date
    ),

    'messages', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('d', g.d, 'n', COALESCE(c.n, 0)) ORDER BY g.d), '[]'::jsonb)
      FROM generate_series(v_from, v_to, '1 day'::interval) AS g(d)
      LEFT JOIN (
        SELECT created_at::date AS dd, count(*) AS n
        FROM public.messages WHERE created_at::date >= v_from GROUP BY 1
      ) c ON c.dd = g.d::date
    ),

    'revenue', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('d', g.d, 'n', COALESCE(c.n, 0)) ORDER BY g.d), '[]'::jsonb)
      FROM generate_series(v_from, v_to, '1 day'::interval) AS g(d)
      LEFT JOIN (
        SELECT completed_at::date AS dd, sum(amount_xof) AS n
        FROM public.payments
        WHERE status = 'completed' AND completed_at::date >= v_from
        GROUP BY 1
      ) c ON c.dd = g.d::date
    ),

    -- ── Totaux ─────────────────────────────────────────────
    'totals', jsonb_build_object(
      'members',        (SELECT count(*) FROM public.profiles),
      'new_members',    (SELECT count(*) FROM public.profiles WHERE created_at::date >= v_from),
      'active_7d',      (SELECT count(*) FROM public.profiles
                         WHERE last_seen >= timezone('utc'::text, now()) - interval '7 days'),
      'active_30d',     (SELECT count(*) FROM public.profiles
                         WHERE last_seen >= timezone('utc'::text, now()) - interval '30 days'),
      'paying',         (SELECT count(*) FROM public.subscriptions
                         WHERE plan_id <> 'gratuit' AND expires_at > timezone('utc'::text, now())),
      'revenue_total',  (SELECT COALESCE(sum(amount_xof), 0) FROM public.payments WHERE status = 'completed'),
      'revenue_period', (SELECT COALESCE(sum(amount_xof), 0) FROM public.payments
                         WHERE status = 'completed' AND completed_at::date >= v_from),
      'orders_period',  (SELECT count(*) FROM public.payments
                         WHERE status = 'completed' AND completed_at::date >= v_from),
      'pending',        (SELECT count(*) FROM public.payments WHERE status = 'pending'),
      'failed_period',  (SELECT count(*) FROM public.payments
                         WHERE status = 'failed' AND created_at::date >= v_from)
    ),

    -- ── Répartition des ventes ─────────────────────────────
    'by_offer', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'offer_id', offer_id, 'n', n, 'revenue', revenue) ORDER BY revenue DESC), '[]'::jsonb)
      FROM (
        SELECT offer_id, count(*) AS n, sum(amount_xof) AS revenue
        FROM public.payments WHERE status = 'completed'
        GROUP BY offer_id
      ) x
    ),

    -- ── Entonnoir ──────────────────────────────────────────
    -- Comptages de membres DISTINCTS : c'est le seul chiffre qui répond à
    -- « combien de personnes sont allées jusque-là ».
    'funnel', jsonb_build_object(
      'inscrits',  (SELECT count(*) FROM public.profiles),
      'ont_swipe', (SELECT count(DISTINCT swiper_id) FROM public.swipes),
      'ont_match', (SELECT count(*) FROM (
                      SELECT user1_id AS u FROM public.matches
                      UNION SELECT user2_id FROM public.matches) m),
      'ont_ecrit', (SELECT count(DISTINCT sender_id) FROM public.messages),
      'ont_paye',  (SELECT count(DISTINCT user_id) FROM public.payments WHERE status = 'completed')
    ),

    -- ── Répartitions ───────────────────────────────────────
    'by_country', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('k', COALESCE(country, 'Non renseigné'), 'n', n)
                                ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT country, count(*) AS n FROM public.profiles GROUP BY country ORDER BY n DESC LIMIT 8) x
    ),

    'by_gender', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('k', COALESCE(gender, 'Non renseigné'), 'n', n)), '[]'::jsonb)
      FROM (SELECT gender, count(*) AS n FROM public.profiles GROUP BY gender) x
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics(integer) TO authenticated;

-- ------------------------------------------------------------
-- 2. Billetterie de support
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'autre'
    CHECK (category IN ('compte', 'paiement', 'technique', 'signalement', 'suggestion', 'autre')),
  -- open    : attend une réponse de l'équipe
  -- pending : l'équipe a répondu, on attend le membre
  -- resolved: réglé, mais le membre peut relancer
  -- closed  : clos, plus aucune réponse possible
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('basse', 'normal', 'haute')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  first_reply_at timestamp with time zone,
  closed_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON public.support_tickets (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx
  ON public.support_tickets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_staff boolean NOT NULL DEFAULT false,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx
  ON public.support_messages (ticket_id, created_at);

ALTER TABLE public.support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Le membre voit et ouvre ses propres tickets ; l'équipe voit tout.
DROP POLICY IF EXISTS "Members read own tickets" ON public.support_tickets;
CREATE POLICY "Members read own tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Members open tickets" ON public.support_tickets;
CREATE POLICY "Members open tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Seule l'équipe change statut et priorité : laisser un membre passer son
-- ticket en « haute » viderait la notion de priorité de son sens.
DROP POLICY IF EXISTS "Admins update tickets" ON public.support_tickets;
CREATE POLICY "Admins update tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Read ticket messages" ON public.support_messages;
CREATE POLICY "Read ticket messages"
ON public.support_messages FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.support_tickets t
             WHERE t.id = ticket_id AND t.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Write ticket messages" ON public.support_messages;
CREATE POLICY "Write ticket messages"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.support_tickets t
               WHERE t.id = ticket_id AND t.user_id = auth.uid()
                 AND t.status <> 'closed')
  )
);

-- ------------------------------------------------------------
-- 3. `is_staff` ne se déclare pas, il se constate
-- ------------------------------------------------------------
-- Sans ce trigger, n'importe quel membre pourrait insérer un message avec
-- `is_staff: true` et se faire passer pour l'équipe dans son propre ticket —
-- capture d'écran à l'appui. La valeur envoyée est donc ignorée.
CREATE OR REPLACE FUNCTION public.set_support_message_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.is_staff := public.is_admin();

  UPDATE public.support_tickets t
  SET updated_at = timezone('utc'::text, now()),
      first_reply_at = CASE
        WHEN NEW.is_staff AND t.first_reply_at IS NULL
        THEN timezone('utc'::text, now()) ELSE t.first_reply_at END,
      -- Une réponse de l'équipe met le ticket en attente du membre ; une
      -- réponse du membre le remet dans la file, même s'il était résolu.
      status = CASE
        WHEN t.status = 'closed' THEN t.status
        WHEN NEW.is_staff THEN 'pending'
        ELSE 'open' END
  WHERE t.id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_message_role ON public.support_messages;
CREATE TRIGGER trg_support_message_role
BEFORE INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.set_support_message_role();

-- ------------------------------------------------------------
-- 4. Ouvrir un ticket avec son premier message
-- ------------------------------------------------------------
-- En deux requêtes séparées, une coupure réseau entre les deux laisserait
-- un ticket vide et incompréhensible. Ici c'est atomique.
CREATE OR REPLACE FUNCTION public.open_support_ticket(
  p_subject text,
  p_body text,
  p_category text DEFAULT 'autre'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id   uuid;
  v_open integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF length(trim(COALESCE(p_subject, ''))) < 3 OR length(trim(COALESCE(p_body, ''))) < 10 THEN
    RAISE EXCEPTION 'TICKET_TOO_SHORT'
      USING HINT = 'Décrivez votre demande en quelques mots de plus.';
  END IF;

  -- Garde-fou : cinq tickets ouverts, c'est déjà beaucoup. Au-delà, on
  -- invite à poursuivre dans un fil existant plutôt qu'à en créer un de
  -- plus — sinon la file devient ingérable pour une seule personne.
  SELECT count(*) INTO v_open
  FROM public.support_tickets
  WHERE user_id = v_user AND status IN ('open', 'pending');

  IF v_open >= 5 THEN
    RAISE EXCEPTION 'TOO_MANY_OPEN_TICKETS'
      USING HINT = 'Vous avez déjà 5 demandes en cours. Poursuivez dans l''une d''elles.';
  END IF;

  INSERT INTO public.support_tickets (user_id, subject, category)
  VALUES (v_user, trim(p_subject), COALESCE(p_category, 'autre'))
  RETURNING id INTO v_id;

  INSERT INTO public.support_messages (ticket_id, author_id, body)
  VALUES (v_id, v_user, trim(p_body));

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_support_ticket(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_support_ticket(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_support_ticket(text, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 5. Vue d'ensemble du support, pour le back-office
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_support_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'open',     (SELECT count(*) FROM public.support_tickets WHERE status = 'open'),
    'pending',  (SELECT count(*) FROM public.support_tickets WHERE status = 'pending'),
    'resolved', (SELECT count(*) FROM public.support_tickets WHERE status = 'resolved'),
    'closed',   (SELECT count(*) FROM public.support_tickets WHERE status = 'closed'),
    'total',    (SELECT count(*) FROM public.support_tickets),
    -- Délai moyen de première réponse, en heures. C'est l'indicateur qui
    -- compte : un ticket résolu vite mais répondu tard laisse quand même
    -- le membre seul face à son problème.
    'avg_first_reply_hours', (
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (first_reply_at - created_at)) / 3600)::numeric, 1)
      FROM public.support_tickets WHERE first_reply_at IS NOT NULL
    ),
    'unanswered_over_24h', (
      SELECT count(*) FROM public.support_tickets
      WHERE status = 'open' AND first_reply_at IS NULL
        AND created_at < timezone('utc'::text, now()) - interval '24 hours'
    ),
    'by_category', (
      SELECT COALESCE(jsonb_object_agg(category, n), '{}'::jsonb)
      FROM (SELECT category, count(*) AS n FROM public.support_tickets GROUP BY category) x
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_support_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_support_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_support_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 6. Contrôle
-- ------------------------------------------------------------
SELECT public.admin_analytics(30)     AS analytics;
SELECT public.admin_support_stats()   AS support;
