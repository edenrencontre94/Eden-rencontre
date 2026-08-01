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
