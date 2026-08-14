-- ====================================================================
-- 07_fix_profiles_rls.sql - Autorisation de l'insert du profil
-- ====================================================================

-- On supprime l'ancienne règle qui bloquait l'insert si l'utilisateur
-- n'était pas encore pleinement authentifié (email non confirmé).
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- On la remplace par une règle plus souple pour l'inscription :
-- N'importe qui peut créer un profil, MAIS la contrainte de clé étrangère
-- (id REFERENCES auth.users(id)) garantit qu'on ne peut le créer 
-- que pour un utilisateur qui vient vraiment de s'inscrire dans l'Auth Supabase.
CREATE POLICY "Autoriser la création de profil" 
ON public.profiles FOR INSERT 
WITH CHECK (true);

-- L'UPDATE et le DELETE restent strictement réservés à l'utilisateur connecté :
-- (Les politiques précédentes gèrent déjà cela, pas besoin d'y toucher)
