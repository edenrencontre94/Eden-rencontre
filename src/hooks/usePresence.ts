import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function usePresence() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Fonction pour envoyer un "ping"
    const pingPresence = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      // Appel à la fonction RPC pour mettre à jour la date sans surcharger le frontend
      await supabase.rpc('update_last_seen');
    };

    // Ping au chargement initial
    pingPresence();

    // Ping toutes les 2 minutes (120000 ms)
    intervalRef.current = setInterval(pingPresence, 120000);

    // Mettre à jour au retour sur l'onglet
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pingPresence();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
