import { supabase } from "@/lib/supabase";

/**
 * Visibilité du profil, réglable depuis l'accueil.
 *
 *   tous    — visible de tous les membres
 *   demande — visible uniquement de celles et ceux que J'AI choisis
 *             (c'est-à-dire les personnes que j'ai déjà likées)
 *   pause   — invisible de tous
 *
 * Important : la visibilité masque le profil dans la DÉCOUVERTE, pas dans
 * les relations déjà nouées. Un match, une conversation en cours ou un like
 * reçu restent lisibles — sinon la messagerie afficherait « Membre » dès
 * qu'un interlocuteur passe en pause.
 */
export type Visibility = "tous" | "demande" | "pause";

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  tous: "Visible par tous",
  demande: "Visible sur demande",
  pause: "Profil en pause",
};

/**
 * Identifiants des membres qui m'ont liké.
 * Sert à savoir qui, en mode « demande », m'a autorisé à le voir.
 */
export async function fetchAdmirerIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("swipes")
    .select("swiper_id")
    .eq("target_id", userId)
    .in("action", ["like", "superlike"]);

  if (error) {
    console.error("[visibility] admirateurs:", error);
    return [];
  }
  return (data ?? []).map((s: any) => s.swiper_id);
}

/**
 * Écarte du résultat les profils qui ne doivent pas m'être montrés.
 * À appliquer sur les listes de DÉCOUVERTE uniquement.
 */
export function filterByVisibility<T extends { id: string; visibility?: string | null }>(
  profiles: T[],
  admirerIds: Set<string>,
): T[] {
  return profiles.filter(p => {
    const v = (p.visibility ?? "tous") as Visibility;
    if (v === "pause") return false;
    // En mode « demande », le profil ne s'affiche que pour les personnes
    // qu'il a lui-même choisies — donc celles qu'il a likées.
    if (v === "demande") return admirerIds.has(p.id);
    return true;
  });
}

/** Exclut côté serveur les profils en pause (les NULL restent visibles). */
export function excludePaused(query: any) {
  return query.or("visibility.is.null,visibility.neq.pause");
}

/**
 * Remonte en tête les profils dont le Boost est encore actif.
 * C'est ce qui donne sa valeur au Boost : sans ce tri, l'achat ne
 * produirait aucun effet visible.
 */
export function boostedFirst<T extends { boosted_until?: string | null }>(profiles: T[]): T[] {
  const now = Date.now();
  const isBoosted = (p: T) =>
    Boolean(p.boosted_until) && new Date(p.boosted_until as string).getTime() > now;

  return [...profiles].sort((a, b) => {
    const ba = isBoosted(a);
    const bb = isBoosted(b);
    if (ba === bb) return 0;
    return ba ? -1 : 1;
  });
}
