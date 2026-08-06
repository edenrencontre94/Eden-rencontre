import { supabase } from "@/lib/supabase";

/**
 * Filtres de découverte.
 *
 * Ils étaient appliqués dans le navigateur sur 100 profils déjà chargés :
 * filtrer sur « Sénégal » ne cherchait pas les Sénégalais de la base, cela
 * ne gardait que ceux présents par hasard dans le lot. Tout passe désormais
 * par `discover_profiles`, qui filtre en base.
 */

export type Filters = {
  // Ouverts à tous
  country: string;
  ageMin: number;
  ageMax: number;
  // Réservés aux formules payantes
  marital: string[];
  denomination: string[];
  attendance: string[];
  education: string[];
  intent: string[];
  heightMin: number | null;
  heightMax: number | null;
  maxKm: number | null;
  verifiedOnly: boolean;
};

export const DEFAULT_FILTERS: Filters = {
  country: "",
  ageMin: 18,
  ageMax: 70,
  marital: [],
  denomination: [],
  attendance: [],
  education: [],
  intent: [],
  heightMin: null,
  heightMax: null,
  maxKm: null,
  verifiedOnly: false,
};

/** Un tableau vide vaut « aucun filtre » : on envoie NULL, pas `{}`. */
const arr = (v: string[]) => (v.length > 0 ? v : null);

export function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.country) n++;
  if (f.ageMin !== DEFAULT_FILTERS.ageMin || f.ageMax !== DEFAULT_FILTERS.ageMax) n++;
  if (f.marital.length) n++;
  if (f.denomination.length) n++;
  if (f.attendance.length) n++;
  if (f.education.length) n++;
  if (f.intent.length) n++;
  if (f.heightMin || f.heightMax) n++;
  if (f.maxKm) n++;
  if (f.verifiedOnly) n++;
  return n;
}

export async function fetchDeck(f: Filters, limit = 100) {
  const { data, error } = await supabase.rpc("discover_profiles", {
    p_country: f.country || null,
    p_age_min: f.ageMin,
    p_age_max: f.ageMax,
    p_marital: arr(f.marital),
    p_denomination: arr(f.denomination),
    p_attendance: arr(f.attendance),
    p_education: arr(f.education),
    p_intent: arr(f.intent),
    p_height_min: f.heightMin,
    p_height_max: f.heightMax,
    p_max_km: f.maxKm,
    p_verified: f.verifiedOnly ? true : null,
    p_limit: limit,
  });

  if (error) {
    console.error("[filtres] découverte:", error);
    return { rows: [], error };
  }
  return { rows: (data ?? []) as any[], error: null };
}

export type FilterOptions = {
  pays: { valeur: string; n: number }[];
  denominations: { valeur: string; n: number }[];
  frequentation: string[];
  etudes: string[];
  intentions: string[];
};

/**
 * Options tirées des données réelles.
 *
 * Proposer « Sénégal » quand aucun Sénégalais n'est inscrit produit un
 * filtre qui ne renvoie rien, et laisse croire à un bug.
 */
export async function fetchFilterOptions(): Promise<FilterOptions> {
  const { data, error } = await supabase.rpc("filter_options");
  if (error || !data) {
    console.error("[filtres] options:", error);
    return { pays: [], denominations: [], frequentation: [], etudes: [], intentions: [] };
  }
  return data as FilterOptions;
}

// ─── Localisation ────────────────────────────────────────────────────────────

export type LocationState = "inconnu" | "refuse" | "actif" | "indisponible";

/**
 * Demande la position et l'enregistre.
 *
 * Le navigateur affiche sa propre demande d'autorisation : inutile d'en
 * ajouter une avant, cela ferait deux questions pour une seule décision.
 * En revanche l'appel n'est déclenché que par un clic explicite — jamais
 * au chargement de la page.
 */
export async function enableLocation(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, reason: "indisponible" };
  }

  const pos = await new Promise<GeolocationPosition | null>(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve(p),
      () => resolve(null),
      // 10 s suffisent : au-delà, mieux vaut rendre la main que laisser
      // un bouton tourner indéfiniment.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });

  if (!pos) return { ok: false, reason: "refuse" };

  const { error } = await supabase.rpc("set_my_location", {
    p_lat: pos.coords.latitude,
    p_lng: pos.coords.longitude,
    p_share: true,
  });

  if (error) {
    console.error("[filtres] position:", error);
    return { ok: false, reason: "erreur" };
  }
  return { ok: true };
}

/** Coupe le partage sans effacer les coordonnées enregistrées. */
export async function disableLocation(): Promise<boolean> {
  const { error } = await supabase.rpc("set_my_location", {
    p_lat: null,
    p_lng: null,
    p_share: false,
  });
  if (error) {
    console.error("[filtres] désactivation position:", error);
    return false;
  }
  return true;
}
