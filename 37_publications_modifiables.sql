-- ============================================================
-- Publications modifiables par leur auteur
-- ============================================================
-- Les politiques RLS autorisaient déjà UPDATE et DELETE au propriétaire.
-- Ce qui manquait, c'est la trace : sans horodatage de modification, rien
-- ne distingue un texte d'origine d'un texte réécrit après coup — dans une
-- communauté de foi où l'on cite des versets et où l'on prie les uns pour
-- les autres, cette transparence n'est pas un détail.

-- ------------------------------------------------------------
-- 1. Trace de modification
-- ------------------------------------------------------------
ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

-- L'horodatage est posé PAR LA BASE, jamais par le client : envoyé depuis
-- le navigateur, il serait falsifiable — il suffirait de ne pas le mettre
-- à jour pour masquer une réécriture.
CREATE OR REPLACE FUNCTION public.mark_post_edited()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Seule une modification du CONTENU compte. Les compteurs de likes et de
  -- commentaires changent en permanence : les prendre en compte afficherait
  -- « modifié » sur une publication que personne n'a touchée.
  IF NEW.text IS DISTINCT FROM OLD.text
     OR NEW.category  IS DISTINCT FROM OLD.category
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.video_url IS DISTINCT FROM OLD.video_url THEN
    NEW.edited_at := timezone('utc'::text, now());
  END IF;

  -- L'auteur d'une publication ne change jamais. Sans cette ligne, un
  -- UPDATE pourrait la réattribuer — la politique RLS s'appliquant à la
  -- ligne d'origine, pas à sa cible.
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_edited ON public.community_posts;
CREATE TRIGGER trg_post_edited
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.mark_post_edited();

-- ------------------------------------------------------------
-- 2. Un texte vide n'est pas une publication
-- ------------------------------------------------------------
-- Rien n'empêchait de vider le texte par modification, laissant une carte
-- fantôme dans le fil.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_text_not_blank'
  ) THEN
    -- Les publications déjà vides sont d'abord réparées, sinon la
    -- contrainte échouerait sur l'existant.
    UPDATE public.community_posts
    SET text = '(publication sans texte)'
    WHERE length(trim(COALESCE(text, ''))) = 0
      AND COALESCE(image_url, '') = ''
      AND COALESCE(video_url, '') = '';

    ALTER TABLE public.community_posts
    ADD CONSTRAINT community_posts_text_not_blank
    CHECK (
      length(trim(COALESCE(text, ''))) > 0
      OR COALESCE(image_url, '') <> ''
      OR COALESCE(video_url, '') <> ''
    );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. La modération conserve la main
-- ------------------------------------------------------------
-- Un membre peut effacer sa publication ; un administrateur doit pouvoir
-- retirer celle d'un autre. Sans cette politique, la page Modération ne
-- pourrait rien supprimer.
DROP POLICY IF EXISTS "Admins remove any post" ON public.community_posts;
CREATE POLICY "Admins remove any post"
ON public.community_posts FOR DELETE TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update any post" ON public.community_posts;
CREATE POLICY "Admins update any post"
ON public.community_posts FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 4. Contrôle
-- ------------------------------------------------------------
SELECT
  count(*)                                  AS publications,
  count(*) FILTER (WHERE edited_at IS NOT NULL) AS modifiees
FROM public.community_posts;
