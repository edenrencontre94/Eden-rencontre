/**
 * Score de compatibilité.
 *
 * Il remplace un `Math.random() * 20 + 80` qui affichait un pourcentage
 * inventé : deux personnes voyaient un score différent l'une pour l'autre,
 * et il changeait à chaque rechargement. Sur une application qui promet des
 * rencontres orientées vers le mariage, un chiffre décoratif décrédibilise.
 *
 * Le calcul ci-dessous est symétrique, stable, et explicable à l'utilisateur.
 */

export type ScoringProfile = {
  id?: string;
  birth_date?: string | null;
  city?: string | null;
  country?: string | null;
  denomination?: string | null;
  practice_level?: string | null;
  church_attendance?: string | null;
  baptized?: boolean | string | null;
  marriage_intent?: string | null;
  wants_children?: boolean | string | null;
  bio?: string | null;
  photos?: string[] | null;
};

/** Poids de chaque critère. Total = 100. */
const WEIGHTS = {
  denomination: 24,
  practice: 20,
  marriage: 18,
  children: 12,
  location: 10,
  age: 10,
  completeness: 6,
} as const;

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function sameNonEmpty(a: unknown, b: unknown): boolean {
  const x = norm(a);
  const y = norm(b);
  return x !== "" && x === y;
}

function ageOf(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age > 0 && age < 120 ? age : null;
}

/**
 * Compatibilité entre deux profils, de 40 à 99.
 * Le plancher à 40 évite d'afficher un score humiliant : personne n'est
 * « 8 % compatible » avec quelqu'un dont le profil est simplement incomplet.
 */
export function compatibilityScore(me: ScoringProfile, other: ScoringProfile): number {
  let earned = 0;
  let available = 0;

  const consider = (weight: number, known: boolean, matched: boolean) => {
    if (!known) return; // critère non renseigné : il ne pénalise personne
    available += weight;
    if (matched) earned += weight;
  };

  // Confession
  consider(
    WEIGHTS.denomination,
    norm(me.denomination) !== "" && norm(other.denomination) !== "",
    sameNonEmpty(me.denomination, other.denomination),
  );

  // Pratique religieuse — la fréquence à l'église départage à niveau égal
  const practiceKnown = norm(me.practice_level) !== "" && norm(other.practice_level) !== "";
  const practiceMatch =
    sameNonEmpty(me.practice_level, other.practice_level) ||
    sameNonEmpty(me.church_attendance, other.church_attendance);
  consider(WEIGHTS.practice, practiceKnown, practiceMatch);

  // Vision du mariage
  consider(
    WEIGHTS.marriage,
    norm(me.marriage_intent) !== "" && norm(other.marriage_intent) !== "",
    sameNonEmpty(me.marriage_intent, other.marriage_intent),
  );

  // Désir d'enfants
  consider(
    WEIGHTS.children,
    me.wants_children != null && other.wants_children != null,
    norm(me.wants_children) === norm(other.wants_children),
  );

  // Proximité : même ville, à défaut même pays
  const cityKnown = norm(me.city) !== "" && norm(other.city) !== "";
  const countryKnown = norm(me.country) !== "" && norm(other.country) !== "";
  if (cityKnown && sameNonEmpty(me.city, other.city)) {
    available += WEIGHTS.location;
    earned += WEIGHTS.location;
  } else if (countryKnown) {
    available += WEIGHTS.location;
    if (sameNonEmpty(me.country, other.country)) earned += WEIGHTS.location * 0.5;
  }

  // Écart d'âge
  const myAge = ageOf(me.birth_date);
  const otherAge = ageOf(other.birth_date);
  if (myAge !== null && otherAge !== null) {
    available += WEIGHTS.age;
    const gap = Math.abs(myAge - otherAge);
    if (gap <= 3) earned += WEIGHTS.age;
    else if (gap <= 6) earned += WEIGHTS.age * 0.7;
    else if (gap <= 10) earned += WEIGHTS.age * 0.4;
  }

  // Profil soigné — une bio et plusieurs photos inspirent confiance
  available += WEIGHTS.completeness;
  const bioLen = (other.bio ?? "").trim().length;
  const photoCount = (other.photos ?? []).length;
  if (bioLen > 80 && photoCount >= 3) earned += WEIGHTS.completeness;
  else if (bioLen > 30 || photoCount >= 2) earned += WEIGHTS.completeness * 0.5;

  if (available === 0) return 60; // rien de comparable : score neutre

  const ratio = earned / available;
  return Math.round(40 + ratio * 59); // 40 → 99
}


/**
 * Classement final du deck : par compatibilité décroissante.
 */
export function rankProfiles<T extends { compatibility: number }>(
  profiles: T[],
): T[] {
  return [...profiles].sort((a, b) => b.compatibility - a.compatibility);
}

