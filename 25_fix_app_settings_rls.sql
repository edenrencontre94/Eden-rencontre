-- ─── Autoriser les administrateurs à modifier les paramètres de l'application ───

-- 1. Politique d'UPDATE
DROP POLICY IF EXISTS "app_settings_update" ON public.app_settings;
CREATE POLICY "app_settings_update" ON public.app_settings
FOR UPDATE TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- 2. Politique d'INSERT (pour les nouveaux paramètres comme support_email)
DROP POLICY IF EXISTS "app_settings_insert" ON public.app_settings;
CREATE POLICY "app_settings_insert" ON public.app_settings
FOR INSERT TO authenticated
WITH CHECK (public.is_staff());

-- 3. On insère les paramètres de support par défaut pour éviter de bloquer l'interface
INSERT INTO public.app_settings (key, value)
VALUES 
  ('support_email', '"contact@edenrencontres.com"'::jsonb),
  ('support_whatsapp', '"+228 98144198"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
