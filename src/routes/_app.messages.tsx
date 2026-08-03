import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/lib/supabase";
import {
  Search, ArrowLeft, Send, Smile, Mic,
  Image as ImageIcon, Video as VideoIcon, Phone, Sticker,
  Check, CheckCheck, MoreVertical, Archive, Flag, Ban,
  X, GalleryHorizontal, Loader2, Play, Pause,
} from "lucide-react";
import { toast } from "sonner";
import { CallView } from "@/components/app/CallView";

export const Route = createFileRoute("/_app/messages")({
  head: () => ({
    meta: [
      { title: "Messages — AgapeMeet" },
      { name: "description", content: "Vos conversations sur AgapeMeet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

type ChatProfile = {
  id: string;
  firstName: string;
  age: number;
  photo: string;
  lastActive: string;
};

type MatchChat = {
  id: string;
  profile: ChatProfile;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  typing: boolean;
};

type Msg = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | "audio" | "gif" | "sticker" | null;
};

function getAge(birthDate: string | null) {
  if (!birthDate) return 25;
  return new Date().getFullYear() - new Date(birthDate).getFullYear();
}

function formatTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeen(isoString: string | null): { text: string; online: boolean } {
  if (!isoString) return { text: "Récemment", online: false };
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 5) return { text: "En ligne", online: true };
  if (diffMins < 60) return { text: `Actif il y a ${diffMins} min`, online: false };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { text: `Actif il y a ${diffHours} h`, online: false };
  const diffDays = Math.floor(diffHours / 24);
  return { text: `Actif il y a ${diffDays} j`, online: false };
}

// ─────────────────────────────────────────────────
// Audio Player Component
// ─────────────────────────────────────────────────
function AudioPlayer({ src, isMe }: { src: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setProgress((audioRef.current!.currentTime / (audioRef.current!.duration || 1)) * 100)}
        onLoadedMetadata={() => setDuration(audioRef.current!.duration)}
        onEnded={() => setPlaying(false)}
      />
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center ${isMe ? "bg-white/20" : "bg-primary/20"}`}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-current opacity-60 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[10px] opacity-60 mt-0.5">
          {duration ? `${Math.floor(duration)}s` : "0s"}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// GIF & Sticker Picker Component (GIPHY API)
// ─────────────────────────────────────────────────
function GifPicker({ onSelect, type = "gif" }: { onSelect: (url: string) => void, type?: "gif" | "sticker" }) {
  const [q, setQ] = useState(type === "gif" ? "love" : "cute");
  const [gifs, setGifs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || "OUhPY0c5X5L5M3kNAJjjkQxqC3kXHzfG";

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    t = setTimeout(search, 500);
    return () => clearTimeout(t);
  }, [q]);

  const search = async () => {
    setLoading(true);
    try {
      const endpoint = type === "gif" ? "gifs" : "stickers";
      const r = await fetch(`https://api.giphy.com/v1/${endpoint}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=12&rating=g`);
      const json = await r.json();
      setGifs((json.data || []).map((g: any) => g.images.fixed_height_small.url));
    } catch {
      // fallback: trending
      const endpoint = type === "gif" ? "gifs" : "stickers";
      const r = await fetch(`https://api.giphy.com/v1/${endpoint}/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`);
      const json = await r.json();
      setGifs((json.data || []).map((g: any) => g.images.fixed_height_small.url));
    } finally { setLoading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="absolute bottom-16 left-0 right-0 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-30"
    >
      <div className="p-2 border-b border-border">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Rechercher un GIF…"
          className="w-full px-3 py-1.5 rounded-lg bg-secondary text-sm focus:outline-none"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-3 gap-1 p-2 max-h-48 overflow-y-auto">
        {loading ? (
          <div className="col-span-3 flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : gifs.map((url, i) => (
          <button key={i} onClick={() => onSelect(url)} className="rounded-lg overflow-hidden hover:opacity-80 transition-opacity">
            <img src={url} alt="gif" className="w-full h-20 object-cover" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────
// Messages Page
// ─────────────────────────────────────────────────
function MessagesPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<MatchChat | null>(null);
  const [chats, setChats] = useState<MatchChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const { data: matchesData } = await supabase
          .from("matches")
          .select("id, created_at, user1_id, user2_id")
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

        if (matchesData && matchesData.length > 0) {
          const otherIds = matchesData.map((m: any) => m.user1_id === user.id ? m.user2_id : m.user1_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, first_name, birth_date, photos, last_seen")
            .in("id", otherIds);

          const profileMap = new Map(profiles?.map((p: any) => [p.id, p]));

          // Fetch last message for each match
          const lastMsgPromises = matchesData.map(m =>
            supabase
              .from("messages")
              .select("content, created_at, sender_id, media_type")
              .eq("match_id", m.id)
              .order("created_at", { ascending: false })
              .limit(1)
          );
          const lastMsgResults = await Promise.all(lastMsgPromises);

          // Fetch unread count for each match (messages from other user not read)
          const unreadPromises = matchesData.map(m =>
            supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("match_id", m.id)
              .neq("sender_id", user.id)
              .is("read_at", null)
          );
          const unreadResults = await Promise.all(unreadPromises);

          const formatted: (MatchChat & { _timestamp: number })[] = matchesData.map((m: any, i) => {
            const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
            const p = profileMap.get(otherId) as any;

            const lastMsgData = lastMsgResults[i].data;
            const lastMsg = lastMsgData && lastMsgData.length > 0 ? lastMsgData[0] : null;
            const unreadCount = unreadResults[i].count || 0;

            let displayMessage = "Cliquez pour commencer à discuter";
            let displayTime = formatTime(m.created_at);
            let timestamp = new Date(m.created_at).getTime();

            if (lastMsg) {
              if (lastMsg.media_type) {
                const typeMap: Record<string, string> = {
                  image: "📷 Image",
                  video: "🎥 Vidéo",
                  audio: "🎤 Message vocal",
                  gif: "GIF",
                  sticker: "Sticker"
                };
                displayMessage = typeMap[lastMsg.media_type] || "Média";
              } else {
                displayMessage = lastMsg.content || "";
              }
              displayTime = formatTime(lastMsg.created_at);
              timestamp = new Date(lastMsg.created_at).getTime();
              
              // Prefix "Vous: " if I sent the last message
              if (lastMsg.sender_id === user.id && !lastMsg.media_type) {
                displayMessage = `Vous: ${displayMessage}`;
              }
            }

            const { text: lastActiveText, online: isOnline } = formatLastSeen(p?.last_seen);

            return {
              id: m.id,
              profile: {
                id: p?.id,
                firstName: p?.first_name || "Membre",
                age: getAge(p?.birth_date),
                photo: p?.photos?.[0] || "https://placehold.co/400x600/1a1a2e/gold?text=😊",
                lastActive: lastActiveText,
              },
              lastMessage: displayMessage,
              time: displayTime,
              unread: unreadCount,
              online: isOnline,
              typing: false,
              _timestamp: timestamp,
            };
          });

          // Sort by most recent activity
          formatted.sort((a, b) => b._timestamp - a._timestamp);
          setChats(formatted);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(
    () => chats.filter(c =>
      c.profile.firstName.toLowerCase().includes(query.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(query.toLowerCase()),
    ),
    [query, chats],
  );

  if (active && userId) return <ChatView chat={active} currentUserId={userId} onBack={() => setActive(null)} />;

  return (
    <div className="px-4 pt-4">
      <h1 className="font-serif text-2xl font-semibold mb-3">Messages</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une conversation…"
          className="w-full pl-10 pr-4 py-2.5 rounded-full bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Nouveaux matches */}
          <div className="mb-6">
            <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">Nouveaux matches</div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {chats.slice(0, 6).map(c => (
                <button key={c.id} onClick={() => setActive(c)} className="shrink-0 flex flex-col items-center gap-1">
                  <div className="relative">
                    <div className="p-0.5 rounded-full bg-gradient-to-tr from-primary to-gold">
                      <img src={c.profile.photo} alt={c.profile.firstName} className="w-14 h-14 rounded-full object-cover border-2 border-background" />
                    </div>
                    {c.online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />}
                  </div>
                  <span className="text-[11px] font-medium max-w-[64px] truncate">{c.profile.firstName}</span>
                </button>
              ))}
              {chats.length === 0 && <span className="text-sm text-muted-foreground">Pas encore de matches</span>}
            </div>
          </div>

          {/* Conversations */}
          <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">Conversations</div>
          <div className="divide-y divide-border rounded-2xl overflow-hidden bg-card border border-border/50">
            {filtered.map(c => (
              <button key={c.id} onClick={() => setActive(c)} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/40 transition-colors text-left">
                <div className="relative">
                  <img src={c.profile.photo} alt={c.profile.firstName} className="w-12 h-12 rounded-full object-cover" />
                  {c.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold truncate">{c.profile.firstName}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{c.time}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className={`text-sm truncate ${c.unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {c.typing ? <em className="text-primary">en train d'écrire…</em> : c.lastMessage}
                    </span>
                    {c.unread > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && chats.length > 0 && <div className="p-6 text-center text-sm text-muted-foreground">Aucune conversation trouvée.</div>}
            {chats.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Allez swiper pour faire des rencontres !</div>}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Chat View
// ─────────────────────────────────────────────────
function ChatView({ chat, currentUserId, onBack }: { chat: MatchChat; currentUserId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showSticker, setShowSticker] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [callState, setCallState] = useState<{ type: "audio" | "video" } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioChunks = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", chat.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Msg[]);
    }
    loadMessages();

    const channel = supabase.channel(`room:${chat.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `match_id=eq.${chat.id}`,
      }, (payload: any) => {
        setMessages(prev => [...prev, payload.new as Msg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chat.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ── Helpers ──
  const uploadMedia = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${currentUserId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(`${folder}/${path}`, file);
    if (error) { toast.error("Erreur upload"); return null; }
    const { data } = supabase.storage.from("chat-media").getPublicUrl(`${folder}/${path}`);
    return data.publicUrl;
  };

  const sendMessage = async (opts: { content?: string; media_url?: string; media_type?: Msg["media_type"] }) => {
    const { error } = await supabase.from("messages").insert({
      match_id: chat.id,
      sender_id: currentUserId,
      content: opts.content || "",
      media_url: opts.media_url || null,
      media_type: opts.media_type || null,
    });
    if (error) toast.error("Erreur d'envoi");
  };

  // ── Send text ──
  const send = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    setShowEmoji(false);
    await sendMessage({ content });
  };

  // ── Send image / video ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadMedia(file, type === "image" ? "images" : "videos");
    if (url) await sendMessage({ media_url: url, media_type: type });
    setUploading(false);
    setShowMedia(false);
    e.target.value = "";
  };

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunks.current = [];
      mr.ondataavailable = e => audioChunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const file = new File([blob], "vocal.webm", { type: "audio/webm" });
        setUploading(true);
        const url = await uploadMedia(file, "audio");
        if (url) await sendMessage({ media_url: url, media_type: "audio" });
        setUploading(false);
      };
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
    } catch { toast.error("Autorisez l'accès au microphone"); }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
    setMediaRecorder(null);
  };

  // ── GIF & Sticker send ──
  const sendGif = async (url: string) => {
    setShowGif(false);
    setShowSticker(false);
    await sendMessage({ media_url: url, media_type: showSticker ? "sticker" : "gif" });
  };

  // ── Emoji ──
  const COMMON_EMOJIS = ["😀", "😂", "🥰", "😍", "🙏", "😭", "🥺", "😊", "🔥", "✨", "❤️", "💯", "👍", "🙌", "👀", "😘", "😎", "💪", "😉", "🎉", "💖", "🥲"];

  // ── Message bubble renderer ──
  const renderBubble = (m: Msg) => {
    const isMe = m.sender_id === currentUserId;
    const base = `max-w-[80%] rounded-2xl text-sm shadow-soft ${isMe
      ? "bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-br-md"
      : "bg-card border border-border/60 rounded-bl-md"
    }`;

    const ts = (
      <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        {formatTime(m.created_at)}
        {isMe && (m.read_at ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
      </div>
    );

    if (m.media_type === "image") return (
      <div className={`${base} overflow-hidden p-0`}>
        <img src={m.media_url!} alt="image" className="max-w-[200px] max-h-[260px] object-cover" onClick={() => window.open(m.media_url!, "_blank")} />
        <div className="px-2 pb-1">{ts}</div>
      </div>
    );

    if (m.media_type === "video") return (
      <div className={`${base} overflow-hidden p-0`}>
        <video src={m.media_url!} controls className="max-w-[220px] rounded-2xl" />
        <div className="px-2 pb-1">{ts}</div>
      </div>
    );

    if (m.media_type === "audio") return (
      <div className={`${base} px-3 py-2`}>
        <AudioPlayer src={m.media_url!} isMe={isMe} />
        {ts}
      </div>
    );

    if (m.media_type === "gif" || m.media_type === "sticker") return (
      <div className={`${base} overflow-hidden p-0 bg-transparent shadow-none border-none`}>
        <img src={m.media_url!} alt={m.media_type} className="max-w-[200px] rounded-2xl" />
        <div className="px-2 pb-1 bg-card rounded-b-2xl mt-1">{ts}</div>
      </div>
    );

    return (
      <div className={`${base} px-3.5 py-2`}>
        <div>{m.content}</div>
        {ts}
      </div>
    );
  };

  // ── Call active ──
  if (callState) return (
    <CallView
      channelName={chat.id}
      callType={callState.type}
      peerName={chat.profile.firstName}
      peerPhoto={chat.profile.photo}
      onEnd={() => setCallState(null)}
    />
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-64px-72px)]">
      {/* Header */}
      <div className="sticky top-14 z-20 flex items-center gap-3 px-3 py-2 border-b border-border/50 bg-background/95 backdrop-blur">
        <button onClick={onBack} aria-label="Retour" className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={chat.profile.photo} className="w-10 h-10 rounded-full object-cover" alt="" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{chat.profile.firstName}, {chat.profile.age}</div>
          <div className="text-[11px] text-muted-foreground">
            {chat.typing ? <span className="text-primary">en train d'écrire…</span> : chat.online ? "En ligne" : chat.profile.lastActive}
          </div>
        </div>
        {/* Call buttons */}
        <button
          onClick={() => setCallState({ type: "audio" })}
          className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center"
          aria-label="Appel audio"
        >
          <Phone className="w-4 h-4 text-primary" />
        </button>
        <button
          onClick={() => setCallState({ type: "video" })}
          className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center"
          aria-label="Appel vidéo"
        >
          <VideoIcon className="w-4 h-4 text-primary" />
        </button>
        {/* Menu */}
        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center" aria-label="Options">
            <MoreVertical className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-11 w-48 bg-card border border-border rounded-xl shadow-elegant py-1 z-30">
                {[
                  { l: "Archiver", i: Archive, action: () => toast.success("Conversation archivée") },
                  { l: "Signaler", i: Flag, action: () => toast.info("Signalement envoyé") },
                  { l: "Bloquer", i: Ban, action: () => toast.info("Utilisateur bloqué") },
                ].map(it => (
                  <button key={it.l} onClick={() => { setMenu(false); it.action(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-left">
                    <it.i className="w-4 h-4" />{it.l}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-secondary/20">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-10">
            Dites bonjour à {chat.profile.firstName} 👋
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUserId ? "justify-end" : "justify-start"}`}>
            {renderBubble(m)}
          </div>
        ))}
        {chat.typing && (
          <div className="flex justify-start">
            <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-4 py-2.5 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]" />
            </div>
          </div>
        )}
      </div>

      {/* Media panel */}
      <AnimatePresence>
        {showMedia && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/50 bg-background px-4 py-3 grid grid-cols-5 gap-3"
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <ImageIcon className="w-6 h-6 text-primary" />
              <span className="text-[10px] font-medium">Image</span>
            </button>
            <button
              onClick={() => videoInputRef.current?.click()}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <VideoIcon className="w-6 h-6 text-primary" />
              <span className="text-[10px] font-medium">Vidéo</span>
            </button>
            <button
              onClick={() => { setShowGif(true); setShowSticker(false); setShowMedia(false); }}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <GalleryHorizontal className="w-6 h-6 text-primary" />
              <span className="text-[10px] font-medium">GIF</span>
            </button>
            <button
              onClick={() => { setShowSticker(true); setShowGif(false); setShowMedia(false); }}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <Sticker className="w-6 h-6 text-primary" />
              <span className="text-[10px] font-medium">Sticker</span>
            </button>
            <button
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-colors ${recording ? "bg-red-500/20" : "bg-primary/10 hover:bg-primary/20"}`}
            >
              <Mic className={`w-6 h-6 ${recording ? "text-red-500 animate-pulse" : "text-primary"}`} />
              <span className="text-[10px] font-medium">{recording ? "●Rec" : "Vocal"}</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "image")} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleFileUpload(e, "video")} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* GIF & Sticker Picker */}
      <div className="relative">
        <AnimatePresence>
          {(showGif || showSticker) && <GifPicker onSelect={sendGif} type={showGif ? "gif" : "sticker"} />}
        </AnimatePresence>
      </div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="border-t border-border/50 bg-card p-3 max-h-48 overflow-y-auto"
          >
            <div className="grid grid-cols-7 gap-2">
              {COMMON_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setText(t => t + e)}
                  className="w-10 h-10 rounded-full hover:bg-secondary text-2xl flex items-center justify-center transition-colors"
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div className="border-t border-border/50 bg-background p-2 flex items-center gap-1.5">
        {/* + Media button */}
        <button
          onClick={() => { setShowMedia(!showMedia); setShowEmoji(false); setShowGif(false); setShowSticker(false); }}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${showMedia ? "bg-primary text-white" : "hover:bg-secondary"}`}
          aria-label="Médias"
        >
          {showMedia ? <X className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
        </button>

        <div className="flex-1 relative">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Écrire un message…"
            className="w-full pl-4 pr-9 py-2.5 rounded-full bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
          />
          <button
            onClick={() => { setShowEmoji(!showEmoji); setShowMedia(false); setShowGif(false); setShowSticker(false); }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center ${showEmoji ? "bg-primary/20" : "hover:bg-secondary/70"}`}
            aria-label="Emoji"
          >
            <Smile className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Send / Mic */}
        {uploading ? (
          <div className="w-10 h-10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : text ? (
          <button onClick={send} aria-label="Envoyer"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-elegant">
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${recording ? "bg-red-500 text-white animate-pulse" : "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"}`}
            aria-label="Message vocal"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
