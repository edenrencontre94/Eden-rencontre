import { supabase } from "@/lib/supabase";

export type CallType = "audio" | "video";
export type CallStatus =
  | "ringing"
  | "accepted"
  | "declined"
  | "cancelled"
  | "missed"
  | "ended";

export type CallRow = {
  id: string;
  match_id: string;
  caller_id: string;
  callee_id: string;
  call_type: CallType;
  status: CallStatus;
  created_at: string;
};

/** Délai avant qu'un appel sans réponse bascule en « missed » */
export const CALL_TIMEOUT_MS = 45_000;

/** Crée l'appel : c'est l'INSERT qui fait sonner le téléphone d'en face. */
export async function createCall(params: {
  matchId: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
}): Promise<{ call: CallRow | null; error: any }> {
  const { data, error } = await supabase
    .from("calls")
    .insert({
      match_id: params.matchId,
      caller_id: params.callerId,
      callee_id: params.calleeId,
      call_type: params.callType,
      status: "ringing",
    })
    .select()
    .single();

  if (error) {
    // L'erreur est REMONTÉE, plus seulement journalisée. Elle était
    // jetée ici : l'appelant ne recevait qu'un `null` et affichait
    // « Impossible de lancer l'appel », sans jamais dire pourquoi —
    // formule insuffisante, compte suspendu ou politique RLS.
    console.error("[calls] création:", error);
    return { call: null, error };
  }
  return { call: data as CallRow, error: null };
}

export async function setCallStatus(callId: string, status: CallStatus) {
  const { error } = await supabase
    .from("calls")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", callId);

  if (error) console.error("[calls] mise à jour du statut:", error);
}

/**
 * Sonnerie synthétisée via Web Audio — évite d'embarquer un fichier audio.
 * Deux notes répétées toutes les 2 s, comme une tonalité d'appel classique.
 */
export function createRingtone() {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const beep = () => {
    if (!ctx) return;
    [0, 0.25].forEach((offset, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.connect(gain);
      gain.connect(ctx!.destination);
      osc.frequency.value = i === 0 ? 880 : 660;
      const start = ctx!.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  };

  return {
    start() {
      try {
        // Les navigateurs bloquent l'audio sans interaction préalable ;
        // l'échec est silencieux, la vibration et l'écran prennent le relais.
        ctx = new AudioContext();
        beep();
        timer = setInterval(beep, 2000);
        navigator.vibrate?.([400, 200, 400]);
      } catch {
        /* sonnerie indisponible */
      }
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      navigator.vibrate?.(0);
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
