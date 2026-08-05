import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Lecture des réglages définis dans /admin/parametres.
 *
 * La table `app_settings` est lisible sans authentification — elle ne
 * contient aucune donnée personnelle — parce que le mode maintenance et
 * l'ouverture des inscriptions doivent pouvoir être consultés avant même
 * qu'un compte existe.
 *
 * Un seul appel réseau par chargement de page : la promesse est mise en
 * cache, pas seulement le résultat. Sans cela, quatre composants montés
 * en même temps déclencheraient quatre requêtes identiques.
 */

type Settings = Record<string, any>;

let cache: Promise<Settings> | null = null;

async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("app_settings").select("key, value");

  if (error) {
    // Un réglage illisible ne doit jamais fermer l'application : on rend
    // un objet vide, et chaque appelant retombe sur sa valeur par défaut.
    console.error("[app_settings]", error);
    return {};
  }

  const map: Settings = {};
  (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
  return map;
}

export function loadSettings(): Promise<Settings> {
  if (!cache) cache = fetchSettings();
  return cache;
}

/** À appeler après une écriture depuis le back-office. */
export function invalidateSettings() {
  cache = null;
}

/**
 * `undefined` tant que la valeur n'est pas connue : cela permet de ne rien
 * afficher pendant le chargement plutôt que de montrer brièvement un état
 * qui sera aussitôt contredit.
 */
export function useSetting<T>(key: string, fallback: T): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then(s => {
      if (cancelled) return;
      setValue(s[key] === undefined ? fallback : (s[key] as T));
    });
    return () => { cancelled = true; };
  }, [key]);

  return value;
}
