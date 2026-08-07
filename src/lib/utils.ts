import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PAYS, normaliser } from "@/content/pays";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Code ISO d'un pays, à partir de son nom stocké en base.
 *
 * Deux tables codées en dur coexistaient — seize entrées ici, vingt-huit
 * dans `_app.decouvrir.tsx` — et aucune ne contenait « Congo (RDC) », la
 * valeur que l'inscription enregistre depuis l'ouverture du sélecteur à
 * 195 pays. Résultat : pas de drapeau, en silence, pour ce pays et pour
 * les 177 absents des deux listes.
 *
 * La source est désormais unique : `src/content/pays.ts`, celle-là même
 * que le sélecteur d'inscription utilise. Tout pays sélectionnable a donc
 * nécessairement son drapeau.
 */
const CODES_PAR_NOM: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const p of PAYS) m[normaliser(p.nom)] = p.code.toLowerCase();

  // Valeurs héritées des anciennes listes, encore présentes sur les
  // profils créés avant le sélecteur complet.
  const alias: Record<string, string> = {
    "rdc": "cd",
    "rd congo": "cd",
    "republique democratique du congo": "cd",
    "congo brazzaville": "cg",
    "congo kinshasa": "cd",
    "centrafrique": "cf",
    "cap vert": "cv",
    "etats unis": "us",
    "usa": "us",
    "angleterre": "gb",
    "grande bretagne": "gb",
    "birmanie": "mm",
    "swaziland": "sz",
    "macedoine": "mk",
    "coree du sud": "kr",
    "republique tcheque": "cz",
    "tchequie": "cz",
    "vietnam": "vn",
    "ile maurice": "mu",
    "sao tome et principe": "st",
  };
  for (const [nom, code] of Object.entries(alias)) m[normaliser(nom)] = code;

  return m;
})();

export const getCountryCode = (countryName?: string | null): string | null => {
  if (!countryName) return null;
  return CODES_PAR_NOM[normaliser(countryName)] ?? null;
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
