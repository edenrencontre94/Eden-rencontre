-- ============================================================
-- CORRECTIF DE SÉCURITÉ — accès au back-office
-- ============================================================
-- `src/routes/admin.tsx` contenait littéralement :
--
--     // On autorise par défaut pour la démo
--     setIsAdmin(true);
--
-- Autrement dit : n'importe quel membre connecté pouvait ouvrir /admin,
-- consulter la liste complète des utilisateurs, certifier ou SUPPRIMER
-- des comptes. Il suffisait de taper l'URL.
--
-- Deux protections sont nécessaires, et la seconde est souvent oubliée :
--   1. savoir qui est administrateur
--   2. empêcher quiconque de le DEVENIR tout seul
--
-- Sans le point 2, ajouter une colonne `role` ne protège rien : la policy
-- de mise à jour du profil permettrait à chacun d'écrire role = 'admin'.

-- ------------------------------------------------------------
-- 1. Le rôle
-- ------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('member', 'moderator', 'admin'));

CREATE INDEX IF NOT EXISTS profiles_role_idx
ON public.profiles (role) WHERE role <> 'member';

-- ------------------------------------------------------------
-- 2. Interdire l'auto-promotion
-- ------------------------------------------------------------
-- Le point crucial. Un membre peut modifier son profil (bio, photos, ville) ;
-- il ne doit pas pouvoir modifier son rôle au passage.
CREATE OR REPLACE FUNCTION public.protect_role_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- auth.uid() vaut NULL côté service_role (Edge Functions, SQL Editor) :
  -- ces contextes sont déjà privilégiés, on les laisse passer.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_caller_role, 'member') <> 'admin' THEN
    RAISE EXCEPTION 'ROLE_CHANGE_FORBIDDEN'
      USING HINT = 'Seul un administrateur peut modifier un rôle.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_role ON public.profiles;
CREATE TRIGGER trg_protect_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_role_column();

-- ------------------------------------------------------------
-- 3. Savoir si l'appelant est administrateur
-- ------------------------------------------------------------
-- Sans paramètre : elle ne peut renseigner que sur SOI-MÊME, donc son
-- exposition à `authenticated` est sans risque.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'moderator') FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'member');
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.my_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated;

-- ------------------------------------------------------------
-- 4. Donner aux administrateurs la lecture dont ils ont besoin
-- ------------------------------------------------------------
-- Les policies actuelles limitent chacun à SES propres lignes. Un
-- administrateur ne verrait donc aucun paiement ni aucun signalement.
-- On ajoute des policies dédiées, en LECTURE seule.

DROP POLICY IF EXISTS "Admins read all payments" ON public.payments;
CREATE POLICY "Admins read all payments"
ON public.payments FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins read all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins read all subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins read all reports" ON public.reports;
CREATE POLICY "Admins read all reports"
ON public.reports FOR SELECT TO authenticated
USING (public.is_admin());

-- La modération doit pouvoir clore un signalement
DROP POLICY IF EXISTS "Admins update reports" ON public.reports;
CREATE POLICY "Admins update reports"
ON public.reports FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins read all boosts" ON public.boosts;
CREATE POLICY "Admins read all boosts"
ON public.boosts FOR SELECT TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------
-- 5. Désigner le premier administrateur
-- ------------------------------------------------------------
-- ⚠️ REMPLACEZ l'adresse ci-dessous par la vôtre AVANT d'exécuter.
-- Sans cette étape, plus personne n'accède au back-office — y compris vous.
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'lawikoura2@gmail.com');

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 6. Contrôle — doit renvoyer au moins une ligne
-- ------------------------------------------------------------
SELECT p.role, u.email, p.first_name
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role <> 'member'
ORDER BY p.role;
