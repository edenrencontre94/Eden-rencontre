-- ============================================================
-- Coordonnées de l'assistance
-- ============================================================
-- Affichées aux membres sur la page d'aide. Rangées dans `app_settings`
-- plutôt que codées en dur : un numéro WhatsApp change, et il ne devrait
-- pas falloir un déploiement pour cela.
--
-- La table est lisible sans authentification — c'est voulu. Ces
-- coordonnées ont vocation à être publiques : les cacher n'aurait aucun
-- sens puisqu'elles sont affichées à qui les demande.

INSERT INTO public.app_settings (key, value, label) VALUES
  ('support_email',    '"contact@agapemeet.com"'::jsonb, 'Adresse e-mail de l''assistance'),
  ('support_whatsapp', '"+228 96479555"'::jsonb,         'Numéro WhatsApp de l''assistance'),
  ('support_hours',
   '"Du lundi au samedi, de 8 h à 20 h (GMT)"'::jsonb,
   'Horaires affichés aux membres'),
  -- Laisser vide masque le bloc côté membre : mieux vaut ne rien annoncer
  -- que promettre un délai qu'on ne tient pas.
  ('support_response_time',
   '"Nous répondons généralement sous 24 heures."'::jsonb,
   'Délai de réponse annoncé')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Contrôle
SELECT key, value FROM public.app_settings
WHERE key LIKE 'support_%' ORDER BY key;
