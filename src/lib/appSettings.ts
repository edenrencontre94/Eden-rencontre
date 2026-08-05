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

/** Toute la table, pour les composants qui lisent plusieurs clés. */
export function useSettings(): Settings | undefined {
  const [value, setValue] = useState<Settings | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then(s => { if (!cancelled) setValue(s); });
    return () => { cancelled = true; };
  }, []);

  return value;
}

/**
 * Aligne les droits affichés sur les quotas réellement en vigueur.
 *
 * `plans.ts` contient les valeurs de référence, écrites en dur. Dès qu'un
 * administrateur ajuste un quota dans /admin/parametres, la base applique la
 * nouvelle limite — l'interface, elle, continuerait d'annoncer l'ancienne.
 * L'utilisateur verrait « 5 messages restants » et serait bloqué à 3, ou
 * l'inverse. C'est ici que les deux se rejoignent.
 */
export function applyQuotaSettings<T extends Record<string, any>>(
  features: T,
  settings: Settings | undefined,
  level: number,
): T {
  if (!settings) return features;

  const num = (key: string, current: number) => {
    const v = settings[key];
    return typeof v === "number" ? v : current;
  };
  const gate = (key: string, fallback: number) => {
    const v = settings[key];
    return level >= (typeof v === "number" ? v : fallback);
  };

  const boosts = num(`quota_boosts_l${level}`, features.boostsPerMonth);
  const voice = gate("min_level_voice_message", 1);
  const calls = gate("min_level_audio_call", 1);

  return {
    ...features,
    dailyMessages: num(`quota_messages_l${level}`, features.dailyMessages),
    dailyLikes: num(`quota_likes_l${level}`, features.dailyLikes),
    superLikesPerDay: num(`quota_superlikes_l${level}`, features.superLikesPerDay),
    superLikeCooldownDays: num(`superlike_cooldown_l${level}`, features.superLikeCooldownDays),
    boostsPerMonth: boosts,
    canBoost: boosts !== 0 && num(`boost_minutes_l${level}`, 30) > 0,
    unlimitedLikes: num(`quota_likes_l${level}`, features.dailyLikes) === -1,
    voiceMessages: voice,
    calls,
    videoCalls: gate("min_level_video_call", 4),
    videoMessages: gate("min_level_video_message", 4),
    communityMedia: gate("min_level_post_image", 1),
    communityVideo: gate("min_level_post_video", 4),
  };
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
