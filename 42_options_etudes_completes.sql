-- ============================================================
-- Niveau d'études : toutes les options proposées au filtrage
-- ============================================================
-- `filter_options()` ne renvoyait que les valeurs DÉJÀ présentes en base.
-- Tant que personne n'avait renseigné « Doctorat », l'option n'existait
-- pas dans le filtre — alors qu'elle figure dans « Mon profil ».
--
-- Deux logiques s'opposent ici, et elles ne se tranchent pas de la même
-- façon selon le champ :
--
--   PAYS et DÉNOMINATION restent tirés des données. Ce sont des listes
--   ouvertes, potentiellement longues ; proposer 195 pays dont 191 vides
--   noierait les quatre qui comptent.
--
--   NIVEAU D'ÉTUDES est une liste FERMÉE, définie par l'application. Elle
--   doit être affichée en entier : sinon l'utilisateur ne comprend pas
--   pourquoi un critère visible dans son profil est absent du filtre.
--
-- La fonction renvoie donc désormais des effectifs pour les études, et
-- l'interface complète la liste avec les niveaux à zéro.

CREATE OR REPLACE FUNCTION public.filter_options()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pays', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('valeur', country, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT country, count(*) AS n FROM public.profiles
        WHERE COALESCE(country, '') <> '' AND COALESCE(visibility, 'tous') <> 'pause'
        GROUP BY country
      ) x
    ),
    'denominations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('valeur', denomination, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT denomination, count(*) AS n FROM public.profiles
        WHERE COALESCE(denomination, '') <> '' AND COALESCE(visibility, 'tous') <> 'pause'
        GROUP BY denomination
      ) x
    ),
    'frequentation', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('valeur', church_attendance, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT church_attendance, count(*) AS n FROM public.profiles
        WHERE COALESCE(church_attendance, '') <> '' AND COALESCE(visibility, 'tous') <> 'pause'
        GROUP BY church_attendance
      ) x
    ),
    -- Effectifs par niveau : l'interface affiche TOUS les niveaux du
    -- formulaire et complète à 0 ceux qui n'apparaissent pas ici.
    'etudes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('valeur', education, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT education, count(*) AS n FROM public.profiles
        WHERE COALESCE(education, '') <> '' AND COALESCE(visibility, 'tous') <> 'pause'
        GROUP BY education
      ) x
    ),
    'intentions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('valeur', marriage_intent, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT marriage_intent, count(*) AS n FROM public.profiles
        WHERE COALESCE(marriage_intent, '') <> '' AND COALESCE(visibility, 'tous') <> 'pause'
        GROUP BY marriage_intent
      ) x
    ),
    -- Situation matrimoniale : même traitement, la liste est fermée et
    -- l'interface la complète depuis MARITAL_STATUSES.
    'situations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('valeur', marital_status, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (
        SELECT marital_status, count(*) AS n FROM public.profiles
        WHERE COALESCE(marital_status, '') <> '' AND COALESCE(visibility, 'tous') <> 'pause'
        GROUP BY marital_status
      ) x
    )
  );
$$;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
SELECT public.filter_options() AS options;
