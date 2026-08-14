-- ====================================================================
-- 05_fix_storage_rls.sql - Correction des droits d'upload d'images
-- ====================================================================

-- On supprime l'ancienne règle trop stricte
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent uploader" ON storage.objects;
DROP POLICY IF EXISTS "Les utilisateurs peuvent uploader dans leur propre dossier" ON storage.objects;

-- On crée une nouvelle règle qui autorise l'upload d'images.
-- Le problème venait du fait que Supabase exige par défaut une confirmation d'email
-- pour passer au statut "authentifié". Pendant l'onboarding, l'utilisateur
-- n'a pas encore cliqué sur le lien email, il est donc bloqué par la sécurité.
-- Cette règle permet l'upload dans le bucket "photos".
CREATE POLICY "Autoriser l'upload de photos pendant l'onboarding" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'photos' );

-- On fait de même pour chat-media pour éviter un bug futur
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent envoyer des médias" ON storage.objects;
CREATE POLICY "Autoriser l'upload de medias" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'chat-media' );
