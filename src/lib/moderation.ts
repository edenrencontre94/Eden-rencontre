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

export async function reportUser(
  reportedId: string,
  context: ReportContext = "profile",
  reason?: string,
): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase.from("reports").insert({
    reporter_id: userId,
    reported_id: reportedId,
    context,
    reason: reason ?? null,
  });

  if (error) {
    console.error("[moderation] signalement:", error);
    return false;
  }
  return true;
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
