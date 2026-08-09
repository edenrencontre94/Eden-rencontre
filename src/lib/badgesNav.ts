import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { poserPastille } from "@/lib/appBadge";

/**
 * Compteurs affichés sur la barre de navigation.
 *
 * Un seul appel RPC pour les trois : la barre est montée sur toutes les
 * pages et se rafraîchit en continu. Trois requêtes REST par cycle,
 * multipliées par le nombre de membres connectés, se paieraient en
 * latence et en quota.
 *
 * Rafraîchissement à deux vitesses :
 *  — Realtime pour ce qui doit être immédiat (un message reçu doit faire
 *    apparaître la pastille tout de suite, comme sur WhatsApp) ;
 *  — un intervalle de sécurité, parce qu'une connexion Realtime tombe
 *    silencieusement sur les réseaux mobiles instables, et qu'on ne
 *    laisserait rien s'afficher pendant des heures.
 */

export type NavBadges = {
  messages: number;
  demandes: number;
  communaute: number;
};

const VIDE: NavBadges = { messages: 0, demandes: 0, communaute: 0 };

/** Filet de sécurité si Realtime décroche. Deux minutes. */
const INTERVALLE_MS = 120_000;

export function useNavBadges(): NavBadges & { refresh: () => void } {
  const [badges, setBadges] = useState<NavBadges>(VIDE);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_badges");

    if (error) {
      // Silencieux et non bloquant : une pastille est un confort. La
      // migration 57 peut ne pas être passée, ou la session avoir expiré
      // — dans les deux cas, l'application doit rester utilisable.
      console.error("[badges]", error);
      return;
    }

    const d = (data ?? {}) as Partial<NavBadges>;
    const suivant = {
      messages: d.messages ?? 0,
      demandes: d.demandes ?? 0,
      communaute: d.communaute ?? 0,
    };
    setBadges(suivant);

    // Pastille sur l'icône de l'application installée.
    //
    // Messages + demandes, PAS la communauté : une pastille rouge doit
    // signaler ce qui s'adresse personnellement au membre. Compter les
    // publications du fil la ferait clignoter en permanence, et on
    // cesserait de la regarder.
    poserPastille(suivant.messages + suivant.demandes);
  }, []);

  useEffect(() => {
    let vivant = true;
    const rafraichir = () => { if (vivant) charger(); };

    rafraichir();

    // Un seul canal pour les trois tables : chaque canal ouvre sa propre
    // connexion WebSocket côté Supabase.
    const canal = supabase
      .channel("badges-nav")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, rafraichir)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "swipes" }, rafraichir)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts" }, rafraichir)
      .subscribe();

    const timer = setInterval(rafraichir, INTERVALLE_MS);

    // Revenir sur l'application après l'avoir laissée en arrière-plan est
    // le moment où l'écart est le plus probable : le navigateur suspend
    // les minuteurs des onglets inactifs.
    const surRetour = () => { if (document.visibilityState === "visible") rafraichir(); };
    document.addEventListener("visibilitychange", surRetour);

    return () => {
      vivant = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", surRetour);
      supabase.removeChannel(canal);
    };
  }, [charger]);

  return { ...badges, refresh: charger };
}

/** Marque la communauté comme lue. Appelée à l'ouverture de /communaute. */
export async function markCommunityRead(): Promise<void> {
  const { error } = await supabase.rpc("mark_community_read");
  if (error) console.error("[badges] lecture communauté:", error);
}
