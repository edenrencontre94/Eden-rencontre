import { useState } from "react";
import { getCountryCode } from "@/lib/utils";
import { drapeauUrl } from "@/content/pays";

/**
 * Drapeau d'un pays, en rond.
 *
 * Quatre endroits affichaient un drapeau, chacun avec sa propre balise
 * `<img>` et sa propre forme. Un composant unique garantit que le pays
 * choisi à l'inscription s'affiche partout de la même manière — et qu'un
 * drapeau introuvable ne laisse jamais d'icône cassée.
 */
export function Drapeau({
  pays,
  className = "w-5 h-5",
}: {
  pays?: string | null;
  className?: string;
}) {
  const [echec, setEchec] = useState(false);
  const code = getCountryCode(pays);

  // Pays inconnu ou image indisponible : on n'affiche rien plutôt qu'un
  // carré vide. Le nom du pays reste à côté, il porte l'information.
  if (!code || echec) return null;

  return (
    <img
      src={drapeauUrl(code)}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setEchec(true)}
      /* object-cover recadre le rectangle du drapeau au centre du cercle.
         Sans lui, l'image serait déformée pour tenir dans un carré. */
      className={`${className} rounded-full object-cover shrink-0 ring-1 ring-black/5`}
    />
  );
}
