-- =====================================================================================
-- 04_eden_storage.sql - Création des Buckets de Stockage pour Eden Rencontre
-- =====================================================================================

-- 1. Création du bucket 'photos' pour les photos de profil
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Création du bucket 'chat-media' pour les photos envoyées en message privé
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Politiques de sécurité (RLS) pour le bucket 'photos'
-- Tout le monde peut voir les photos
CREATE POLICY "Les photos sont publiques" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'photos');

-- Seul l'utilisateur connecté peut envoyer SES photos
CREATE POLICY "Les utilisateurs authentifiés peuvent uploader" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- Seul l'utilisateur propriétaire peut supprimer/modifier ses photos
CREATE POLICY "Les utilisateurs peuvent modifier leurs photos" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'photos' AND auth.uid() = owner);

CREATE POLICY "Les utilisateurs peuvent supprimer leurs photos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'photos' AND auth.uid() = owner);


-- 4. Politiques de sécurité (RLS) pour le bucket 'chat-media'
-- Tout le monde peut voir les médias de chat (l'URL est de toute façon complexe/sécurisée par ID)
CREATE POLICY "Les médias de chat sont publics" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'chat-media');

CREATE POLICY "Les utilisateurs authentifiés peuvent envoyer des médias" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');
