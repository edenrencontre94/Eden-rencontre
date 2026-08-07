import { useState } from "react";

/**
 * Photo de profil, avec repli sur l'initiale.
 *
 * DEUX PROBLÈMES corrigés ici.
 *
 * 1. Le repli était `https://placehold.co/400x600/1a1a2e/gold?text=😊`.
 *    Le service ne dispose d'aucune police contenant les émojis : il
 *    dessine donc le glyphe de substitution, c'est-à-dire un POINT
 *    D'INTERROGATION. Tous les profils sans photo affichaient « ? » sur
 *    fond sombre — l'inverse exact de l'effet recherché.
 *
 * 2. L'autre repli, `api.dicebear.com/...?seed=Abdoul`, envoyait le PRÉNOM
 *    de chaque membre à un service tiers, à chaque affichage de liste.
 *    Aucun consentement ne couvre cela, et rien ne le justifiait : une
 *    initiale se dessine localement.
 *
 * Le repli est désormais rendu par le navigateur, sans requête réseau.
 */
export function Avatar({
  src,
  name,
  className = "",
  rounded = "rounded-full",
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initiale = (name ?? "").trim().charAt(0).toUpperCase() || "·";

  if (!src || failed) {
    return (
      <div
        aria-label={name ?? "Membre sans photo"}
        className={`${className} ${rounded} bg-gradient-to-br from-primary/25 to-gold/25 flex items-center justify-center font-serif font-semibold text-primary select-none`}
      >
        {initiale}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name ?? ""}
      loading="lazy"
      // Une URL morte — photo supprimée du stockage, lien expiré — bascule
      // sur l'initiale plutôt que d'afficher l'icône d'image cassée du
      // navigateur.
      onError={() => setFailed(true)}
      className={`${className} ${rounded} object-cover`}
    />
  );
}
