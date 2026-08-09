/**
 * Pastille sur l'icône de l'application installée.
 *
 * C'est le petit rond rouge chiffré que WhatsApp affiche sur son icône,
 * sans qu'on ait besoin d'ouvrir quoi que ce soit.
 *
 * ⚠️ SUPPORT RÉEL, et il est inégal :
 *
 *   • iPhone (iOS 16.4+, application installée) — fonctionne.
 *   • Windows / macOS, application installée — fonctionne.
 *   • Chrome ANDROID — l'API n'est PAS implémentée. Android affiche à la
 *     place une pastille automatique dès qu'une notification est en
 *     attente : c'est le système qui s'en charge, pas nous. Le résultat
 *     visuel est proche, sans le chiffre.
 *   • Onglet de navigateur ordinaire — sans objet : il n'y a pas d'icône.
 *
 * Les appels échouent silencieusement là où c'est non supporté. Aucun
 * repli n'est possible : on ne peut pas dessiner sur l'écran d'accueil.
 */

type NavigateurAvecPastille = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function pastilleSupportee(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as NavigateurAvecPastille).setAppBadge === "function";
}

/**
 * Pose ou retire la pastille.
 *
 * `0` efface au lieu d'afficher un zéro — une pastille « 0 » serait
 * absurde, et certaines plateformes affichent alors un point vide.
 */
export async function poserPastille(n: number): Promise<void> {
  const nav = navigator as NavigateurAvecPastille;
  if (!nav.setAppBadge) return;

  try {
    if (n > 0) await nav.setAppBadge(n);
    else await nav.clearAppBadge?.();
  } catch {
    // Refus de la plateforme (permission, mode non installé) : sans
    // conséquence, la pastille est un confort.
  }
}
