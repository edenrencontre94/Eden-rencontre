import { useEffect, useState } from "react";

/**
 * Installation de l'application (PWA).
 *
 * L'évènement `beforeinstallprompt` n'est émis QU'UNE FOIS, très tôt
 * après le chargement. Deux composants l'écoutant chacun de son côté
 * n'en captureraient qu'un seul — celui monté à temps. Il est donc
 * intercepté ici, au niveau du module, et partagé.
 *
 * `preventDefault()` est indispensable : sans lui, Chrome affiche SA
 * propre bannière en plus de la nôtre.
 */

type EvtInstall = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let evtDiffere: EvtInstall | null = null;
let installe = false;
const abonnes = new Set<() => void>();

const notifier = () => abonnes.forEach(f => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    evtDiffere = e as EvtInstall;
    notifier();
  });

  window.addEventListener("appinstalled", () => {
    installe = true;
    evtDiffere = null;
    notifier();
    // Seule occasion de dater une installation à la seconde près.
    // Safari n'émet jamais cet évènement : sur iPhone, on ne l'apprendra
    // qu'à la première ouverture depuis l'écran d'accueil.
    signaler("evenement");
  });
}

/** Plateforme, telle qu'on peut l'établir depuis le navigateur. */
export function plateforme(): "android" | "ios" | "desktop" | "autre" {
  if (typeof navigator === "undefined") return "autre";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows|Macintosh|Linux/.test(ua)) return "desktop";
  return "autre";
}

/**
 * Enregistre l'installation en base.
 *
 * Import dynamique de Supabase : ce module est évalué au chargement de
 * la page, y compris sur la vitrine publique. Le tirer statiquement
 * embarquerait le client Supabase dans le premier fragment servi à
 * chaque visiteur.
 *
 * L'échec est silencieux : une statistique manquée ne doit jamais
 * empêcher quoi que ce soit.
 */
async function signaler(source: "evenement" | "ouverture") {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.rpc("signaler_installation", {
      p_platform: plateforme(),
      p_source: source,
      p_user_agent: navigator.userAgent.slice(0, 300),
    });
  } catch (e) {
    console.debug("[install] signalement ignoré", e);
  }
}

/**
 * À appeler au démarrage de l'espace membre.
 *
 * C'est ce qui rattrape iPhone — où `appinstalled` n'existe pas — et les
 * installations faites par le menu du navigateur alors que la page
 * n'était pas ouverte. Rafraîchit aussi `last_seen`, seul moyen de
 * distinguer une installation vivante d'une icône oubliée.
 */
export function signalerSiInstalle() {
  if (typeof window === "undefined") return;
  if (!estInstalle()) return;
  signaler("ouverture");
}

export function estInstalle(): boolean {
  if (typeof window === "undefined") return false;
  return (
    installe ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export function estIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export type EtatInstall = {
  /** Une entrée d'installation a-t-elle un sens ici ? */
  possible: boolean;
  /** iPhone : aucune API, il faut montrer le geste. */
  ios: boolean;
  /** Lance la boîte de dialogue native. Renvoie false sur iOS. */
  installer: () => Promise<boolean>;
};

export function useInstall(): EtatInstall {
  const [, forcer] = useState(0);

  useEffect(() => {
    const f = () => forcer(n => n + 1);
    abonnes.add(f);
    return () => { abonnes.delete(f); };
  }, []);

  const dejaInstalle = estInstalle();
  const ios = estIOS();

  return {
    // Sur iPhone on propose toujours (tant que ce n'est pas installé) :
    // le geste manuel reste possible, il faut juste l'expliquer.
    // Ailleurs, seulement si le navigateur a signalé l'installabilité —
    // afficher un bouton mort sur Firefox serait pire que rien.
    possible: !dejaInstalle && (ios || evtDiffere !== null),
    ios,
    installer: async () => {
      if (!evtDiffere) return false;
      await evtDiffere.prompt();
      const { outcome } = await evtDiffere.userChoice;
      // L'évènement n'est utilisable qu'une fois : Chrome le réémettra
      // plus tard si l'installation n'a pas eu lieu.
      evtDiffere = null;
      notifier();
      return outcome === "accepted";
    },
  };
}
