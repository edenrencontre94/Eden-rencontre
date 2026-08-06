/**
 * Vocabulaire des motifs — signalement et suppression de compte.
 *
 * Les clés sont dupliquées dans les contraintes CHECK de la migration 38.
 * Elles font foi côté base : ajouter un motif ici sans l'ajouter là-bas
 * ferait échouer l'insertion. C'est voulu — mieux vaut une erreur franche
 * qu'un motif enregistré hors vocabulaire, invisible dans les statistiques.
 */

export type ReportReason =
  | "faux_profil" | "contenu_inapproprie" | "harcelement" | "arnaque"
  | "discours_haineux" | "mineur" | "hors_sujet" | "autre";

export const REPORT_REASONS: { key: ReportReason; label: string; hint: string }[] = [
  {
    key: "faux_profil",
    label: "Faux profil ou usurpation",
    hint: "Photos volées, identité qui ne correspond pas",
  },
  {
    key: "arnaque",
    label: "Demande d'argent ou arnaque",
    hint: "Sollicitation financière, lien suspect, chantage",
  },
  {
    key: "harcelement",
    label: "Harcèlement ou insistance",
    hint: "Messages répétés malgré un refus, pression",
  },
  {
    key: "contenu_inapproprie",
    label: "Contenu ou propos déplacés",
    hint: "Photos explicites, langage vulgaire",
  },
  {
    key: "discours_haineux",
    label: "Propos haineux",
    hint: "Insultes, racisme, intolérance religieuse",
  },
  {
    key: "mineur",
    label: "Personne mineure",
    hint: "Traité en priorité absolue",
  },
  {
    key: "hors_sujet",
    label: "Ne cherche pas le mariage",
    hint: "Démarche contraire à la vocation de la plateforme",
  },
  {
    key: "autre",
    label: "Autre motif",
    hint: "Décrivez la situation en quelques mots",
  },
];

export type DeletionReason =
  | "trouve_partenaire" | "peu_de_profils" | "pas_de_reponses" | "trop_cher"
  | "probleme_technique" | "mauvaise_experience" | "pause" | "vie_privee" | "autre";

export const DELETION_REASONS: { key: DeletionReason; label: string; hint?: string }[] = [
  {
    key: "trouve_partenaire",
    label: "J'ai rencontré quelqu'un",
    hint: "La plus belle raison de nous quitter",
  },
  { key: "pause", label: "Je fais une pause" },
  { key: "peu_de_profils", label: "Trop peu de profils près de chez moi" },
  { key: "pas_de_reponses", label: "Je n'ai pas eu de réponses" },
  { key: "trop_cher", label: "Les formules sont trop chères" },
  { key: "mauvaise_experience", label: "Mauvaise expérience avec un membre" },
  { key: "probleme_technique", label: "L'application ne fonctionne pas bien" },
  { key: "vie_privee", label: "Préoccupations sur mes données" },
  { key: "autre", label: "Autre raison" },
];

/** Libellés courts pour le back-office. */
export const REPORT_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map(r => [r.key, r.label]),
);

export const DELETION_LABELS: Record<string, string> = Object.fromEntries(
  DELETION_REASONS.map(r => [r.key, r.label]),
);

/** Messages d'erreur renvoyés par les fonctions de la base. */
export function motifErrorMessage(err: any): string {
  const raw = `${err?.message ?? ""} ${err?.hint ?? ""}`;
  if (raw.includes("ALREADY_REPORTED")) {
    return "Votre signalement précédent est encore en cours d'examen.";
  }
  if (raw.includes("DETAILS_REQUIRED")) {
    return "Précisez votre motif en quelques mots.";
  }
  if (raw.includes("REASON_REQUIRED")) return "Choisissez un motif.";
  if (raw.includes("SELF_REPORT")) return "On ne se signale pas soi-même.";
  return err?.hint || err?.message || "L'opération a échoué.";
}
