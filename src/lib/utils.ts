import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getCountryCode = (countryName: string) => {
  if (!countryName) return null;
  const map: Record<string, string> = {
    "côte d'ivoire": "ci",
    "sénégal": "sn",
    "cameroun": "cm",
    "bénin": "bj",
    "togo": "tg",
    "mali": "ml",
    "burkina faso": "bf",
    "gabon": "ga",
    "congo": "cg",
    "rdc": "cd",
    "guinée": "gn",
    "madagascar": "mg",
    "france": "fr",
    "belgique": "be",
    "suisse": "ch",
    "canada": "ca",
  };
  return map[countryName.toLowerCase()] || null;
};

/**
 * Nom affiché sur les cartes de profil : prénom suivi de l'initiale du
 * nom — « Jean D. ».
 *
 * C'est l'usage sur les applications de rencontre, et pour une raison
 * concrète : un nom complet associé à une photo rend une personne
 * retrouvable sur les réseaux sociaux à partir d'une simple capture
 * d'écran. L'initiale suffit à distinguer deux Jean sans exposer
 * personne.
 *
 * Un seul endroit décide de la forme du nom. Pour afficher le nom entier,
 * remplacer la dernière ligne par :
 *
 *   return `${first} ${last}`;
 *
 * Cas traités : nom absent (facultatif à l'inscription) → prénom seul ;
 * nom composé « Kouassi-N'Guessan » → « K. », l'initiale du premier
 * élément, la plus reconnaissable.
 */
export function displayName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName ?? "").trim() || "Membre";
  const last = (lastName ?? "").trim();
  if (!last) return first;

  // `toLocaleUpperCase` plutôt que `toUpperCase` : les noms saisis en
  // minuscules sont fréquents, et certaines lettres accentuées ne se
  // majusculent correctement qu'avec la locale.
  const initial = last.charAt(0).toLocaleUpperCase("fr-FR");
  return `${first} ${initial}.`;
}
