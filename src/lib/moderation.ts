import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/auth";

export type ReportContext = "profile" | "message" | "community_post" | "call";

/** Bloque un membre. Idempotent : un blocage déjà présent n'est pas une erreur. */
export async function blockUser(blockedId: string, reason?: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from("blocks")
    .upsert(
      { blocker_id: userId, blocked_id: blockedId, reason: reason ?? null },
      { onConflict: "blocker_id,blocked_id" },
    );

  if (error) {
    console.error("[moderation] blocage:", error);
    return false;
  }
  return true;
}

export async function unblockUser(blockedId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", blockedId);

  if (error) {
    console.error("[moderation] déblocage:", error);
    return false;
  }
  return true;
}

/* ── Archivage des conversations ──────────────────────────────
 *
 * Propre à chaque membre : archiver de son côté ne change rien pour
 * l'autre, qui n'a aucune raison de l'apprendre. Un nouveau message
 * désarchive automatiquement chez le destinataire (trigger de la
 * migration 56) — l'archivage range, il ne fait pas taire.
 */

export async function archiveChat(matchId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from("archived_chats")
    .upsert({ user_id: userId, match_id: matchId }, { onConflict: "user_id,match_id" });

  if (error) {
    console.error("[moderation] archivage:", error);
    return false;
  }
  return true;
}

export async function unarchiveChat(matchId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  // `.select()` pour distinguer « rien supprimé » d'un vrai succès : une
  // suppression bloquée par RLS ne renvoie AUCUNE erreur, seulement zéro
  // ligne affectée.
  const { data, error } = await supabase
    .from("archived_chats")
    .delete()
    .eq("user_id", userId)
    .eq("match_id", matchId)
    .select("match_id");

  if (error) {
    console.error("[moderation] désarchivage:", error);
    return false;
  }
  return (data ?? []).length > 0;
}

export async function fetchArchivedIds(): Promise<string[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("archived_chats")
    .select("match_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[moderation] liste des archives:", error);
    return [];
  }
  return (data ?? []).map((a: any) => a.match_id);
}

/** Identifiants des membres bloqués par l'utilisateur courant. */
export async function fetchBlockedIds(): Promise<string[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);

  if (error) {
    console.error("[moderation] liste des blocages:", error);
    return [];
  }
  return (data ?? []).map((b: any) => b.blocked_id);
}

/**
 * Signalement avec motif obligatoire.
 *
 * L'insertion directe dans `reports` a été remplacée par un appel à
 * `submit_report` : elle acceptait `reason` comme paramètre FACULTATIF, et
 * les deux appelants l'omettaient. La modération recevait des signalements
 * sans motif, impossibles à hiérarchiser.
 *
 * La fonction en base impose le motif, refuse l'auto-signalement et bloque
 * les doublons en attente d'examen.
 *
 * Préférez `<ReportDialog />`, qui recueille le motif dans l'interface.
 */
export async function reportUser(
  reportedId: string,
  reason: string,
  details?: string,
  context: ReportContext = "profile",
): Promise<{ ok: boolean; error?: any }> {
  const { error } = await supabase.rpc("submit_report", {
    p_reported_id: reportedId,
    p_reason: reason,
    p_details: details?.trim() || null,
    p_context: context,
  });

  if (error) {
    console.error("[moderation] signalement:", error);
    return { ok: false, error };
  }
  return { ok: true };
}

/** Masque définitivement un like reçu. */
export async function dismissLike(dismissedUserId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from("dismissed_likes")
    .upsert(
      { user_id: userId, dismissed_user_id: dismissedUserId },
      { onConflict: "user_id,dismissed_user_id" },
    );

  if (error) {
    console.error("[moderation] refus:", error);
    return false;
  }
  return true;
}

export async function fetchDismissedIds(): Promise<string[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("dismissed_likes")
    .select("dismissed_user_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[moderation] liste des refus:", error);
    return [];
  }
  return (data ?? []).map((d: any) => d.dismissed_user_id);
}
