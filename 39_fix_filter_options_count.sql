-- ============================================================
-- 39_fix_filter_options_count.sql
--
-- Problème : le compteur de profils par pays affiché dans les
-- filtres (/decouvrir) utilisait un simple COUNT(*) sans
-- appliquer les mêmes exclusions que discover_profiles.
--
-- Résultat : l'utilisateur voyait "55 personnes en Côte d'Ivoire"
-- mais en scrollant n'en trouvait que ~30, car la vraie requête
-- exclut :
--   - les profils sans photo
--   - les profils suspendus / en pause
--   - is_suspended = true
--   - is_paused = true
--
-- Ce fichier aligne filter_options() sur ces mêmes critères.
-- ============================================================

CREATE OR REPLACE FUNCTION public.filter_options()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  pays        JSON;
  denoms      JSON;
  freq        JSON;
  etudes      JSON;
  intentions  JSON;
  situations  JSON;
BEGIN
  SELECT json_agg(r) INTO pays FROM (
    SELECT country AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE country IS NOT NULL
      AND country <> ''
      AND COALESCE(visibility, 'tous') <> 'pause'
      AND COALESCE(is_suspended, false) = false
      AND COALESCE(is_paused, false)    = false
      AND photos IS NOT NULL
      AND array_length(photos, 1) > 0
    GROUP BY country ORDER BY n DESC LIMIT 50
  ) r;

  SELECT json_agg(r) INTO denoms FROM (
    SELECT denomination AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE denomination IS NOT NULL
      AND denomination <> ''
      AND COALESCE(visibility, 'tous') <> 'pause'
      AND COALESCE(is_suspended, false) = false
      AND COALESCE(is_paused, false)    = false
      AND photos IS NOT NULL
      AND array_length(photos, 1) > 0
    GROUP BY denomination ORDER BY n DESC
  ) r;

  SELECT json_agg(r) INTO freq FROM (
    SELECT church_attendance AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE church_attendance IS NOT NULL
      AND church_attendance <> ''
      AND COALESCE(visibility, 'tous') <> 'pause'
      AND COALESCE(is_suspended, false) = false
      AND COALESCE(is_paused, false)    = false
      AND photos IS NOT NULL
      AND array_length(photos, 1) > 0
    GROUP BY church_attendance ORDER BY n DESC
  ) r;

  SELECT json_agg(r) INTO etudes FROM (
    SELECT education AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE education IS NOT NULL
      AND education <> ''
      AND COALESCE(visibility, 'tous') <> 'pause'
      AND COALESCE(is_suspended, false) = false
      AND COALESCE(is_paused, false)    = false
      AND photos IS NOT NULL
      AND array_length(photos, 1) > 0
    GROUP BY education ORDER BY n DESC
  ) r;

  SELECT json_agg(r) INTO intentions FROM (
    SELECT marriage_intent AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE marriage_intent IS NOT NULL
      AND marriage_intent <> ''
      AND COALESCE(visibility, 'tous') <> 'pause'
      AND COALESCE(is_suspended, false) = false
      AND COALESCE(is_paused, false)    = false
      AND photos IS NOT NULL
      AND array_length(photos, 1) > 0
    GROUP BY marriage_intent ORDER BY n DESC
  ) r;

  SELECT json_agg(r) INTO situations FROM (
    SELECT marital_status AS valeur, COUNT(*) AS n
    FROM public.profiles
    WHERE marital_status IS NOT NULL
      AND marital_status <> ''
      AND COALESCE(visibility, 'tous') <> 'pause'
      AND COALESCE(is_suspended, false) = false
      AND COALESCE(is_paused, false)    = false
      AND photos IS NOT NULL
      AND array_length(photos, 1) > 0
    GROUP BY marital_status ORDER BY n DESC
  ) r;

  RETURN json_build_object(
    'pays',          COALESCE(pays,       '[]'::json),
    'denominations', COALESCE(denoms,     '[]'::json),
    'frequentation', COALESCE(freq,       '[]'::json),
    'etudes',        COALESCE(etudes,     '[]'::json),
    'intentions',    COALESCE(intentions, '[]'::json),
    'situations',    COALESCE(situations, '[]'::json)
  );
END;
$$;
