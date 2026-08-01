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

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID as string;

interface CallViewProps {
  channelName: string; // Use match ID as channel
  callType: "audio" | "video";
  peerName: string;
  peerPhoto: string;
  onEnd: () => void;
}

export function CallView({ channelName, callType, peerName, peerPhoto, onEnd }: CallViewProps) {
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

  const startCall = async () => {
    try {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // Listen for remote user joining
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

      // Join channel (using null token for testing - use server token in production)
      await client.join(AGORA_APP_ID, channelName, null, null);

      // Create local tracks
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
    } catch (err) {
      console.error("Agora error:", err);
      toast.error("Impossible d'initier l'appel. Vérifiez les autorisations micro/caméra.");
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
