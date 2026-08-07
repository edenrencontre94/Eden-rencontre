-- ============================================================
-- Équipes et permissions
-- ============================================================
-- Jusqu'ici, deux états seulement : membre ou administrateur tout-puissant.
-- Confier la modération à quelqu'un revenait à lui donner les paramètres,
-- les revenus et le pouvoir de nommer d'autres administrateurs.
--
-- CHOIX STRUCTURANT : la permission est vérifiée EN BASE, dans chaque
-- fonction, pas seulement dans le menu. Un menu masqué n'est pas une
-- sécurité — c'est exactement le travers qu'on a corrigé sur les filtres
-- et sur la communauté.
--
-- `is_admin()` reste réservé au rôle « admin ». Les fonctions qui doivent
-- s'ouvrir à d'autres rôles sont réécrites plus bas avec `can()`. Celles
-- qui ne le sont pas restent volontairement fermées : paramètres,
-- marketing, analytics et abonnements demeurent le domaine du seul
-- administrateur.

-- ------------------------------------------------------------
-- 1. Les rôles
-- ------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('member', 'redacteur', 'support', 'moderator', 'admin'));

-- ------------------------------------------------------------
-- 2. La matrice des permissions
-- ------------------------------------------------------------
-- En table plutôt qu'en code : la matrice se lit, s'audite et se corrige
-- sans redéploiement. Une permission oubliée se voit d'un SELECT.
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role text NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Lisible par toute l'équipe : chacun doit pouvoir savoir ce qu'il peut
-- faire. Modifiable par personne depuis le client — seule cette migration
-- l'écrit.
DROP POLICY IF EXISTS "Staff reads permissions" ON public.role_permissions;
CREATE POLICY "Staff reads permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (true);

DELETE FROM public.role_permissions;

INSERT INTO public.role_permissions (role, permission) VALUES
  -- Administrateur : tout, y compris la composition de l'équipe.
  ('admin', 'membres'), ('admin', 'moderation'), ('admin', 'conversations'),
  ('admin', 'contenus'), ('admin', 'support'), ('admin', 'finances'),
  ('admin', 'reglages'), ('admin', 'equipe'),

  -- Modérateur : la sécurité des membres. Il voit les fiches et les
  -- conversations, suspend, traite les signalements — mais ne touche ni
  -- aux revenus, ni aux réglages, ni à l'équipe.
  ('moderator', 'membres'), ('moderator', 'moderation'),
  ('moderator', 'conversations'), ('moderator', 'contenus'),

  -- Support : répond aux demandes. Accès aux fiches membres pour
  -- instruire un cas, et aux gestes commerciaux — sans droit de sanction.
  ('support', 'membres'), ('support', 'support'),

  -- Rédacteur : le contenu éditorial, rien d'autre. Aucun accès aux
  -- données personnelles des membres.
  ('redacteur', 'contenus');

-- ------------------------------------------------------------
-- 3. Les fonctions de contrôle
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can(p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role = p.role
    WHERE p.id = auth.uid() AND rp.permission = p_permission
  );
$$;

-- Appartenance à l'équipe, sans distinction de rôle : sert à l'accès au
-- back-office lui-même.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role <> 'member' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Ce que l'interface lit pour savoir quoi afficher. Ne renseigne QUE sur
-- soi-même : impossible de sonder les droits d'autrui.
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  SELECT COALESCE(role, 'member') INTO v_role
  FROM public.profiles WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'role', COALESCE(v_role, 'member'),
    'is_staff', COALESCE(v_role, 'member') <> 'member',
    'permissions', COALESCE((
      SELECT jsonb_agg(permission ORDER BY permission)
      FROM public.role_permissions WHERE role = v_role
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can(text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;

-- ------------------------------------------------------------
-- 4. Gestion de l'équipe
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_team()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can('equipe') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'membres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nom', COALESCE(p.first_name, 'Membre')
               || COALESCE(' ' || left(p.last_name, 1) || '.', ''),
        'role', p.role,
        'photo', CASE WHEN p.photos IS NOT NULL AND array_length(p.photos, 1) > 0
                      THEN p.photos[1] ELSE NULL END,
        'created_at', p.created_at,
        'last_seen', p.last_seen,
        'permissions', COALESCE((
          SELECT jsonb_agg(rp.permission ORDER BY rp.permission)
          FROM public.role_permissions rp WHERE rp.role = p.role
        ), '[]'::jsonb),
        -- Nombre d'actions tracées : une équipe se pilote sur ce qui est
        -- fait, pas sur les rôles attribués.
        'consultations', (SELECT count(*) FROM public.admin_access_log l
                          WHERE l.admin_id = p.id)
      ) ORDER BY
        CASE p.role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2
                    WHEN 'support' THEN 3 ELSE 4 END,
        p.first_name)
      FROM public.profiles p
      WHERE p.role <> 'member'
    ), '[]'::jsonb),
    'matrice', COALESCE((
      SELECT jsonb_object_agg(role, perms)
      FROM (
        SELECT role, jsonb_agg(permission ORDER BY permission) AS perms
        FROM public.role_permissions GROUP BY role
      ) x
    ), '{}'::jsonb)
  );
END;
$$;

-- Attribution d'un rôle.
CREATE OR REPLACE FUNCTION public.admin_set_role(
  p_user_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_moi     uuid := auth.uid();
  v_ancien  text;
  v_admins  integer;
BEGIN
  IF NOT public.can('equipe') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_role NOT IN ('member', 'redacteur', 'support', 'moderator', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'role_inconnu');
  END IF;

  -- On ne modifie pas son propre rôle. Sans cette règle, une erreur de
  -- manipulation peut retirer à quelqu'un le droit de la corriger.
  IF p_user_id = v_moi THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'soi_meme');
  END IF;

  SELECT role INTO v_ancien FROM public.profiles WHERE id = p_user_id;
  IF v_ancien IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'introuvable');
  END IF;

  -- Le dernier administrateur ne peut pas être rétrogradé : la plateforme
  -- se retrouverait sans personne pour rétablir la situation.
  IF v_ancien = 'admin' AND p_role <> 'admin' THEN
    SELECT count(*) INTO v_admins FROM public.profiles WHERE role = 'admin';
    IF v_admins <= 1 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'dernier_admin');
    END IF;
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;

  INSERT INTO public.admin_access_log (admin_id, match_id, motif)
  VALUES (v_moi, NULL,
          'Rôle modifié : ' || COALESCE(v_ancien, '?') || ' → ' || p_role);

  RETURN jsonb_build_object('ok', true, 'ancien', v_ancien, 'nouveau', p_role);
END;
$$;

-- Recherche d'un membre à intégrer à l'équipe.
CREATE OR REPLACE FUNCTION public.admin_search_member(p_query text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q text := NULLIF(trim(COALESCE(p_query, '')), '');
BEGIN
  IF NOT public.can('equipe') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF v_q IS NULL OR length(v_q) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nom', COALESCE(p.first_name, 'Membre')
             || COALESCE(' ' || left(p.last_name, 1) || '.', ''),
      'ville', p.city,
      'role', p.role,
      'photo', CASE WHEN p.photos IS NOT NULL AND array_length(p.photos, 1) > 0
                    THEN p.photos[1] ELSE NULL END
    ) ORDER BY p.first_name)
    FROM public.profiles p
    WHERE p.role = 'member'
      AND (p.first_name ILIKE '%' || v_q || '%'
        OR p.last_name  ILIKE '%' || v_q || '%'
        OR p.city       ILIKE '%' || v_q || '%')
    LIMIT 20
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_team() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_search_member(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_member(text) TO authenticated;

-- ------------------------------------------------------------
-- 5. Le trigger anti-promotion accepte la nouvelle voie
-- ------------------------------------------------------------
-- `protect_role_column` refuse toute écriture de `role` par un non-admin.
-- `admin_set_role` est SECURITY DEFINER, donc exécutée comme propriétaire
-- de la fonction : le trigger la laisse passer. Il est réécrit ici pour
-- accepter aussi les rôles nouvellement introduits.
CREATE OR REPLACE FUNCTION public.protect_role_column()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_role text;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- auth.uid() est NULL côté service_role et dans l'éditeur SQL : ces
  -- contextes sont déjà de confiance.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_caller_role, 'member') <> 'admin' THEN
    RAISE EXCEPTION 'ROLE_CHANGE_FORBIDDEN'
      USING HINT = 'Seul un administrateur attribue les rôles.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 6. Les gardes s'ouvrent aux rôles concernés
-- ------------------------------------------------------------
-- Chaque fonction reçoit la permission qui lui correspond. Sans cela, le
-- système de rôles ne serait qu'un menu grisé : un rédacteur pourrait
-- appeler la lecture des conversations depuis la console du navigateur.

-- Contenus ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_pending_posts(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can('contenus') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'moderation_active', public.setting_bool('community_moderation', false),
    'en_attente', (SELECT count(*) FROM public.community_posts WHERE status = 'pending'),
    'rejetes',    (SELECT count(*) FROM public.community_posts WHERE status = 'rejected'),
    'posts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id, 'text', c.text, 'category', c.category,
        'image_url', c.image_url, 'video_url', c.video_url,
        'created_at', c.created_at,
        'auteur', COALESCE(p.first_name, 'Membre'),
        'auteur_id', c.user_id,
        'auteur_photo', CASE WHEN p.photos IS NOT NULL AND array_length(p.photos, 1) > 0
                             THEN p.photos[1] ELSE NULL END,
        'signalements', (SELECT count(*) FROM public.reports r
                         WHERE r.reported_id = c.user_id AND r.status = 'pending')
      ) ORDER BY c.created_at ASC), '[]'::jsonb)
      FROM (
        SELECT * FROM public.community_posts
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
      ) c
      LEFT JOIN public.profiles p ON p.id = c.user_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_post(
  p_post_id uuid, p_approve boolean, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can('contenus') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF NOT p_approve AND length(trim(COALESCE(p_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'motif');
  END IF;

  UPDATE public.community_posts SET
    status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = auth.uid(),
    rejection_reason = CASE WHEN p_approve THEN NULL ELSE trim(p_reason) END
  WHERE id = p_post_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Le blog suit la permission « contenus »
DROP POLICY IF EXISTS "Admins manage posts" ON public.blog_posts;
CREATE POLICY "Content team manages posts"
ON public.blog_posts FOR ALL TO authenticated
USING (public.can('contenus')) WITH CHECK (public.can('contenus'));

-- Modération ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_review_post_report(
  p_report_id uuid, p_action text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_post uuid;
BEGIN
  IF NOT public.can('moderation') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_action NOT IN ('dismiss', 'hide', 'delete') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'action');
  END IF;

  SELECT post_id INTO v_post FROM public.community_reports WHERE id = p_report_id;
  IF v_post IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'introuvable');
  END IF;

  IF p_action = 'hide' THEN
    UPDATE public.community_posts
    SET status = 'rejected',
        reviewed_at = timezone('utc'::text, now()),
        reviewed_by = auth.uid(),
        rejection_reason = 'Retirée à la suite d''un signalement'
    WHERE id = v_post;
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.community_posts WHERE id = v_post;
  END IF;

  UPDATE public.community_reports SET
    status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END,
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = auth.uid()
  WHERE post_id = v_post AND status = 'pending';

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Suspension : réservée à la modération et à l'administration
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_user_id uuid, p_reason text, p_days integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_now   timestamp with time zone := timezone('utc'::text, now());
  v_fin   timestamp with time zone;
  v_role  text;
BEGIN
  IF NOT public.can('moderation') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_user_id = v_admin THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self');
  END IF;

  -- Aucun membre de l'équipe ne peut être suspendu par un autre : cela
  -- relève d'un retrait de rôle, pas d'une sanction de modération.
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  IF COALESCE(v_role, 'member') <> 'member' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'admin_cible');
  END IF;

  IF length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'motif');
  END IF;

  IF p_days IS NOT NULL AND (p_days < 1 OR p_days > 365) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duree');
  END IF;

  v_fin := CASE
    WHEN p_days IS NULL THEN v_now + interval '100 years'
    ELSE v_now + make_interval(days => p_days)
  END;

  UPDATE public.profiles SET
    suspended_until = v_fin,
    suspension_reason = trim(p_reason),
    suspended_at = v_now,
    suspended_by = v_admin,
    visibility = 'pause'
  WHERE id = p_user_id;

  INSERT INTO public.suspensions (user_id, suspended_by, reason, days, starts_at, ends_at)
  VALUES (p_user_id, v_admin, trim(p_reason), p_days, v_now, v_fin);

  RETURN jsonb_build_object('ok', true, 'until', v_fin, 'permanent', p_days IS NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_now   timestamp with time zone := timezone('utc'::text, now());
BEGIN
  IF NOT public.can('moderation') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE public.profiles SET
    suspended_until = NULL, suspension_reason = NULL,
    suspended_at = NULL, suspended_by = NULL, visibility = 'tous'
  WHERE id = p_user_id;

  UPDATE public.suspensions
  SET lifted_at = v_now, lifted_by = v_admin
  WHERE user_id = p_user_id AND lifted_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Conversations ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_read_conversation(
  p_match_id uuid, p_motif text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existe boolean;
BEGIN
  IF NOT public.can('conversations') THEN
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
        'read_at', m.read_at, 'created_at', m.created_at
      ) ORDER BY m.created_at ASC)
      FROM public.messages m
      LEFT JOIN public.profiles p ON p.id = m.sender_id
      WHERE m.match_id = p_match_id
    ), '[]'::jsonb)
  );
END;
$$;

-- Support ──────────────────────────────────────────────────
-- Les tickets et leurs réponses suivent la permission « support ».
DROP POLICY IF EXISTS "Members read own tickets" ON public.support_tickets;
CREATE POLICY "Members read own tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can('support'));

DROP POLICY IF EXISTS "Admins update tickets" ON public.support_tickets;
CREATE POLICY "Support updates tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (public.can('support')) WITH CHECK (public.can('support'));

DROP POLICY IF EXISTS "Read ticket messages" ON public.support_messages;
CREATE POLICY "Read ticket messages"
ON public.support_messages FOR SELECT TO authenticated
USING (
  public.can('support')
  OR EXISTS (SELECT 1 FROM public.support_tickets t
             WHERE t.id = ticket_id AND t.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Write ticket messages" ON public.support_messages;
CREATE POLICY "Write ticket messages"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.can('support')
    OR EXISTS (SELECT 1 FROM public.support_tickets t
               WHERE t.id = ticket_id AND t.user_id = auth.uid()
                 AND t.status <> 'closed')
  )
);

-- `is_staff` remplace `is_admin` dans le marquage d'un message d'équipe :
-- une réponse du support doit porter le badge « AgapeMeet », qu'elle vienne
-- de l'administrateur ou d'un agent.
CREATE OR REPLACE FUNCTION public.set_support_message_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.is_staff := public.can('support');

  UPDATE public.support_tickets t
  SET updated_at = timezone('utc'::text, now()),
      first_reply_at = CASE
        WHEN NEW.is_staff AND t.first_reply_at IS NULL
        THEN timezone('utc'::text, now()) ELSE t.first_reply_at END,
      status = CASE
        WHEN t.status = 'closed' THEN t.status
        WHEN NEW.is_staff THEN 'pending'
        ELSE 'open' END
  WHERE t.id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

-- Gestes commerciaux : le support en a besoin pour réparer un incident.
CREATE OR REPLACE FUNCTION public.admin_grant_days(
  p_user_id uuid, p_days integer, p_reason text, p_plan text DEFAULT 'premium'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_base  timestamp with time zone;
  v_fin   timestamp with time zone;
  v_now   timestamp with time zone := timezone('utc'::text, now());
BEGIN
  IF NOT public.can('support') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'days');
  END IF;

  IF length(trim(COALESCE(p_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'motif');
  END IF;

  IF p_plan NOT IN ('premium', 'vip') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan');
  END IF;

  SELECT GREATEST(COALESCE(premium_until, v_now), v_now) INTO v_base
  FROM public.profiles WHERE id = p_user_id;

  IF v_base IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'introuvable');
  END IF;

  v_fin := v_base + make_interval(days => p_days);

  UPDATE public.profiles
  SET premium_until = v_fin,
      public_plan = CASE
        WHEN public_plan = 'vip' OR p_plan = 'vip' THEN 'vip'
        ELSE 'premium' END
  WHERE id = p_user_id;

  INSERT INTO public.subscriptions (user_id, plan_id, expires_at, started_at, updated_at)
  VALUES (p_user_id, p_plan, v_fin, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE
  SET plan_id    = CASE WHEN subscriptions.plan_id = 'vip' OR EXCLUDED.plan_id = 'vip'
                        THEN 'vip' ELSE 'premium' END,
      expires_at = EXCLUDED.expires_at,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.admin_grants (user_id, granted_by, days, plan_id, reason)
  VALUES (p_user_id, v_admin, p_days, p_plan, trim(p_reason));

  RETURN jsonb_build_object('ok', true, 'expires_at', v_fin, 'plan', p_plan);
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 7. Contrôle
-- ------------------------------------------------------------
SELECT role, string_agg(permission, ', ' ORDER BY permission) AS permissions
FROM public.role_permissions GROUP BY role
ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2
                   WHEN 'support' THEN 3 ELSE 4 END;

SELECT public.my_permissions() AS mes_droits;
SELECT public.admin_team()     AS equipe;
