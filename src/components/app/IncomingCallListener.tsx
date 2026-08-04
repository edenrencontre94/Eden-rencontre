import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Phone, PhoneOff, Video as VideoIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { createRingtone, setCallStatus, type CallRow } from "@/lib/calls";
import { useCurrentUserId } from "@/lib/auth";

// Chargé à la demande : le SDK Agora pèse ~1,5 Mo et ce composant est monté
// dans le layout, donc un import statique le ferait télécharger sur CHAQUE page.
const CallView = lazy(() =>
  import("@/components/app/CallView").then(m => ({ default: m.CallView })),
);

type Caller = { first_name: string | null; photos: string[] | null };

/** Affiché le temps que le SDK d'appel se télécharge */
function CallLoading() {
  return (
    <div className="fixed inset-0 z-[60] bg-[#0d0d1a] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-white/60 text-sm">Connexion…</p>
    </div>
  );
}

/**
 * Écoute les appels entrants pour l'utilisateur connecté et affiche l'écran
 * de sonnerie. Monté dans le layout `_app` afin de fonctionner depuis
 * n'importe quelle page, pas seulement la messagerie.
 */
export function IncomingCallListener() {
  const userId = useCurrentUserId() ?? null;
  const [incoming, setIncoming] = useState<CallRow | null>(null);
  const [caller, setCaller] = useState<Caller | null>(null);
  const [accepted, setAccepted] = useState(false);

  const ringtone = useRef<ReturnType<typeof createRingtone> | null>(null);

  // ── Écoute des appels qui me sont destinés ──
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`incoming-calls:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `callee_id=eq.${userId}`,
        },
        (payload: any) => {
          const call = payload.new as CallRow;
          if (call.status !== "ringing") return;

          setIncoming(call);
          setAccepted(false);

          supabase
            .from("profiles")
            .select("first_name, photos")
            .eq("id", call.caller_id)
            .single()
            .then(({ data }: any) => setCaller((data as Caller) ?? null));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── L'appelant a annulé pendant que ça sonnait ──
  useEffect(() => {
    if (!incoming || accepted) return;

    const channel = supabase
      .channel(`call-watch:${incoming.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${incoming.id}`,
        },
        (payload: any) => {
          const status = (payload.new as CallRow).status;
          if (status === "cancelled" || status === "missed" || status === "ended") {
            setIncoming(null);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [incoming, accepted]);

  // ── Sonnerie tant que l'appel n'est pas décroché ──
  useEffect(() => {
    if (incoming && !accepted) {
      ringtone.current = createRingtone();
      ringtone.current.start();
    }
    return () => {
      ringtone.current?.stop();
      ringtone.current = null;
    };
  }, [incoming, accepted]);

  const accept = async () => {
    if (!incoming) return;
    ringtone.current?.stop();
    await setCallStatus(incoming.id, "accepted");
    setAccepted(true);
  };

  const decline = async () => {
    if (!incoming) return;
    ringtone.current?.stop();
    await setCallStatus(incoming.id, "declined");
    setIncoming(null);
  };

  const hangUp = async () => {
    if (incoming) await setCallStatus(incoming.id, "ended");
    setIncoming(null);
    setAccepted(false);
  };

  // Appel décroché → on bascule sur la vue d'appel, même canal Agora que l'appelant
  if (incoming && accepted) {
    return (
      <Suspense fallback={<CallLoading />}>
        <CallView
          channelName={incoming.match_id}
          callType={incoming.call_type}
          peerName={caller?.first_name || "Membre"}
          peerPhoto={caller?.photos?.[0] ?? ""}
          callId={incoming.id}
          role="callee"
          onEnd={hangUp}
        />
      </Suspense>
    );
  }

  const name = caller?.first_name || "Membre";
  const photo = caller?.photos?.[0];

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-[#0d0d1a] flex flex-col items-center justify-center gap-8 px-6"
        >
          <div className="relative">
            {photo ? (
              <img src={photo} alt={name} className="w-32 h-32 rounded-full object-cover border-4 border-primary/30" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 to-gold/30 flex items-center justify-center font-serif text-4xl font-semibold text-primary border-4 border-primary/30">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
          </div>

          <div className="text-center">
            <h2 className="text-white text-2xl font-bold">{name}</h2>
            <p className="text-white/60 mt-1 flex items-center justify-center gap-1.5">
              {incoming.call_type === "video"
                ? <><VideoIcon className="w-4 h-4" /> Appel vidéo entrant…</>
                : <><Phone className="w-4 h-4" /> Appel audio entrant…</>}
            </p>
          </div>

          <div className="flex items-center gap-12 mt-4">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={decline}
                aria-label="Refuser l'appel"
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <span className="text-white/60 text-xs">Refuser</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={accept}
                aria-label="Répondre à l'appel"
                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg transition-all active:scale-95 animate-bounce"
              >
                {incoming.call_type === "video"
                  ? <VideoIcon className="w-7 h-7 text-white" />
                  : <Phone className="w-7 h-7 text-white" />}
              </button>
              <span className="text-white/60 text-xs">Répondre</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
