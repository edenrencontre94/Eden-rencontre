-- Promouvoir l'utilisateur en administrateur Eden Rencontre
-- UID : a2d39d3f-00eb-460a-a9d8-ca5476aaf733

INSERT INTO public.staff_roles (user_id, role)
VALUES ('a2d39d3f-00eb-460a-a9d8-ca5476aaf733', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
