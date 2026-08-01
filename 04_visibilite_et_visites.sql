-- 1. Ajouter la colonne visibility à la table profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'tous'::text;

-- 2. Créer la table profile_visits
CREATE TABLE IF NOT EXISTS public.profile_visits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    visitor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    visited_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(visitor_id, visited_id)
);

-- Activer RLS sur profile_visits
ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;

-- Politiques pour profile_visits
-- N'importe quel utilisateur connecté peut créer une visite (enregistrer qu'il visite qqn)
CREATE POLICY "Users can create a visit" 
ON public.profile_visits FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = visitor_id);

-- Un utilisateur peut mettre à jour une visite (ex: modifier la date de la dernière visite)
CREATE POLICY "Users can update their own visits" 
ON public.profile_visits FOR UPDATE 
TO authenticated 
USING (auth.uid() = visitor_id);

-- Un utilisateur peut voir la liste des gens qui L'ONT visité
CREATE POLICY "Users can view their visitors" 
ON public.profile_visits FOR SELECT 
TO authenticated 
USING (auth.uid() = visited_id);
