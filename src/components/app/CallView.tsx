import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Phone,
  RotateCcw, Volume2, VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { setCallStatus, CALL_TIMEOUT_MS } from "@/lib/calls";

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID as string;

interface CallViewProps {
  channelName: string; // Use match ID as channel
  callType: "audio" | "video";
  peerName: string;
  peerPhoto: string;
  /** Ligne `calls` associée — sert à la signalisation (refus, raccroché, non-réponse) */
  callId?: string;
  /** L'appelant attend une réponse ; le destinataire a déjà décroché */
  role?: "caller" | "callee";
  onEnd: () => void;
}

export function CallView({ channelName, callType, peerName, peerPhoto, callId, role = "caller", onEnd }: CallViewProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const localVideoElRef = useRef<HTMLDivElement>(null);
  const remoteVideoElRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<"calling" | "connected" | "ended">("calling");
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCall();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (status === "connected") {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // Le pair a-t-il rejoint ? (lu dans des closures asynchrones, d'où la ref)
  const remoteJoinedRef = useRef(false);
  useEffect(() => { remoteJoinedRef.current = remoteJoined; }, [remoteJoined]);

  // ── Signalisation : refus, raccroché d'en face, absence de réponse ──
  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call-status:${callId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
        (payload: any) => {
          const newStatus = payload.new.status as string;
          if (newStatus === "declined") {
            toast.info(`${peerName} a refusé l'appel`);
            onEnd();
          } else if (newStatus === "ended" || newStatus === "cancelled") {
            onEnd();
          }
        },
      )
      .subscribe();

    // Sans réponse au bout du délai imparti, l'appelant abandonne
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (role === "caller") {
      timeout = setTimeout(async () => {
        if (remoteJoinedRef.current) return;
        await setCallStatus(callId, "missed");
        toast.info(`${peerName} n'a pas répondu`);
        onEnd();
      }, CALL_TIMEOUT_MS);
    }

    return () => {
      supabase.removeChannel(channel);
      if (timeout) clearTimeout(timeout);
    };
  }, [callId, role, peerName]);

  const startCall = async () => {
    try {
      if (!AGORA_APP_ID) {
        toast.error("Appels non configurés : VITE_AGORA_APP_ID manquant dans le .env");
        onEnd();
        return;
      }

      // ── 1. Récupérer le token Agora depuis la Supabase Edge Function ──
      const { data: { session } } = await (await import("@/lib/supabase")).supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

      const tokenRes = await fetch(
        `${supabaseUrl}/functions/v1/agora-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ channelName, uid: "0", expireSecs: 3600 }),
        }
      );

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || "Token generation failed");
      }

      // L'App ID renvoyé par le serveur fait foi : c'est celui dont le
      // certificat a signé le token. Utiliser une autre valeur côté client
      // provoque « invalid vendor key, can not find appid ».
      const { token, appId: serverAppId } = await tokenRes.json();
      const appId = serverAppId || AGORA_APP_ID;

      if (serverAppId && serverAppId !== AGORA_APP_ID) {
        console.warn(
          "[agora] VITE_AGORA_APP_ID diffère de l'App ID du serveur ; celui du serveur est utilisé.",
          { client: AGORA_APP_ID, serveur: serverAppId },
        );
      }

      // ── 2. Créer le client Agora et rejoindre ──
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        setRemoteJoined(true);
        setStatus("connected");

        if (mediaType === "video") {
          const remoteVideo = user.videoTrack as IRemoteVideoTrack;
          if (remoteVideoElRef.current) {
            remoteVideo.play(remoteVideoElRef.current);
          }
        }
        if (mediaType === "audio") {
          const remoteAudio = user.audioTrack as IRemoteAudioTrack;
          remoteAudio.play();
        }
      });

      client.on("user-unpublished", () => {
        setRemoteJoined(false);
      });

      client.on("user-left", () => {
        setStatus("ended");
        toast.info(`${peerName} a raccroché`);
        setTimeout(onEnd, 2000);
      });

      // Rejoindre avec le token sécurisé
      await client.join(appId, channelName, token, null);

      // ── 3. Créer les tracks locaux ──
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localAudioRef.current = audioTrack;

      if (callType === "video") {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        localVideoRef.current = videoTrack;
        if (localVideoElRef.current) {
          videoTrack.play(localVideoElRef.current);
        }
        await client.publish([audioTrack, videoTrack]);
      } else {
        await client.publish([audioTrack]);
      }
    } catch (err: any) {
      console.error("Agora error:", err);
      if (err?.name === "NotAllowedError" || err?.code === "PERMISSION_DENIED") {
        toast.error("Autorisations micro/caméra refusées. Vérifiez les paramètres de votre navigateur.");
      } else if (err?.message?.includes("can not find appid") || err?.message?.includes("invalid vendor key")) {
        toast.error("App ID Agora inconnu. Vérifiez le projet dans la console Agora et AGORA_APP_ID côté Supabase.");
      } else if (err?.message?.includes("dynamic key") || err?.message?.includes("invalid token")) {
        toast.error("Token Agora refusé. Le certificat du serveur ne correspond pas à l'App ID.");
      } else if (err?.message?.includes("Token")) {
        toast.error("Erreur de token Agora. Vérifiez la configuration serveur.");
      } else {
        toast.error(`Impossible d'initier l'appel : ${err?.message || "erreur inconnue"}`);
      }
      onEnd();
    }
  };

  const cleanup = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    localAudioRef.current?.close();
    localVideoRef.current?.close();
    await clientRef.current?.leave();
  };

  const handleEnd = async () => {
    // Raccrocher avant que l'autre décroche = annulation, sinon fin d'appel
    if (callId) {
      await setCallStatus(callId, remoteJoinedRef.current ? "ended" : "cancelled");
    }
    await cleanup();
    onEnd();
  };

  const toggleMute = () => {
    if (localAudioRef.current) {
      localAudioRef.current.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleCam = () => {
    if (localVideoRef.current) {
      localVideoRef.current.setMuted(!isCamOff);
      setIsCamOff(!isCamOff);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0d0d1a] flex flex-col"
    >
      {/* Remote video / Background */}
      {callType === "video" ? (
        <div ref={remoteVideoElRef} className="absolute inset-0 bg-black">
          {!remoteJoined && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <img
                  src={peerPhoto}
                  alt={peerName}
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary/30"
                />
                <span className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
              </div>
              <div className="text-center">
                <h2 className="text-white text-2xl font-bold">{peerName}</h2>
                <p className="text-white/60 mt-1">
                  {status === "calling" ? "Appel en cours…" : "Connexion…"}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Audio call — full background */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary/30 to-[#0d0d1a]">
          <div className="relative">
            <img
              src={peerPhoto}
              alt={peerName}
              className="w-36 h-36 rounded-full object-cover border-4 border-white/20"
            />
            {status === "connected" && (
              <span className="absolute inset-0 rounded-full border-4 border-primary/40 animate-ping" />
            )}
          </div>
          <div className="text-center">
            <h2 className="text-white text-2xl font-bold">{peerName}</h2>
            <p className="text-white/60 mt-1">
              {status === "calling" ? "Appel en cours…" :
               status === "connected" ? formatDuration(callDuration) :
               "Appel terminé"}
            </p>
          </div>
        </div>
      )}

      {/* Local video (pip) — video call only */}
      {callType === "video" && (
        <div
          ref={localVideoElRef}
          className="absolute top-4 right-4 w-28 h-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg bg-black z-10"
        />
      )}

      {/* Top bar: duration */}
      {status === "connected" && callType === "video" && (
        <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full">
          <span className="text-white text-sm font-mono">{formatDuration(callDuration)}</span>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-12 inset-x-0 z-10 flex items-center justify-center gap-6">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isMuted ? "bg-white/20" : "bg-white/10 hover:bg-white/20"
          }`}
        >
          {isMuted
            ? <MicOff className="w-6 h-6 text-white" />
            : <Mic className="w-6 h-6 text-white" />
          }
        </button>

        {callType === "video" && (
          <button
            onClick={toggleCam}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isCamOff ? "bg-white/20" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            {isCamOff
              ? <VideoOff className="w-6 h-6 text-white" />
              : <Video className="w-6 h-6 text-white" />
            }
          </button>
        )}

        {/* End call */}
        <button
          onClick={handleEnd}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>

        {callType === "audio" && (
          <button
            onClick={() => setIsSpeakerOff(!isSpeakerOff)}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            {isSpeakerOff
              ? <VolumeX className="w-6 h-6 text-white" />
              : <Volume2 className="w-6 h-6 text-white" />
            }
          </button>
        )}

        {callType === "video" && (
          <button className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
            <RotateCcw className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Status: ended */}
      <AnimatePresence>
        {status === "ended" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/70 flex items-center justify-center"
          >
            <div className="text-center">
              <Phone className="w-10 h-10 text-white/40 mx-auto mb-2" />
              <p className="text-white text-lg font-semibold">Appel terminé</p>
              <p className="text-white/50 text-sm">{formatDuration(callDuration)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
