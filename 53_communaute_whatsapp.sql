-- ============================================================
-- Canal WhatsApp de la communauté
-- ============================================================
-- Le lien était écrit en dur dans `src/routes/_app.guide.tsx`. Un canal
-- WhatsApp se recrée — après une suppression accidentelle, un changement
-- d'administrateur, une refonte — et il ne devrait pas falloir un
-- déploiement pour rediriger les membres.
--
-- Rangé au même endroit que les coordonnées d'assistance (migration 35),
-- pour la même raison : lisible sans authentification, puisque destiné à
-- être affiché à qui le demande.
--
-- Vide = section masquée côté membre. Un bouton « Rejoindre » qui mène
-- vers un canal supprimé est pire que pas de bouton du tout : le membre
-- croit à une panne de l'application.

INSERT INTO public.app_settings (key, value, label) VALUES
  ('community_whatsapp',
   '"https://whatsapp.com/channel/0029Vb93f4D35fLrflJx9g0U"'::jsonb,
   'Lien du canal WhatsApp de la communauté'),

  -- Le texte d'accroche évolue plus souvent que le lien : nouvelle
  -- série d'enseignements, campagne de prière, annonce d'événement.
  ('community_whatsapp_pitch',
   '"Enseignements, témoignages de couples, temps de prière et annonces : notre canal WhatsApp prolonge ce que vous vivez ici."'::jsonb,
   'Texte de présentation du canal communautaire')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Contrôle
SELECT key, value, label FROM public.app_settings
WHERE key LIKE 'community_%' ORDER BY key;
