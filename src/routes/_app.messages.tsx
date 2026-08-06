import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import {
  Search, ArrowLeft, Send, Smile, Mic,
  Image as ImageIcon, Video as VideoIcon, Phone, Sticker,
  Check, CheckCheck, MoreVertical, Archive, Flag, Ban,
  X, GalleryHorizontal, Loader2, Play, Pause, BadgeCheck, Lock,
} from "lucide-react";
import { toast } from "sonner";
// Le SDK Agora (~1,5 Mo) n'est téléchargé qu'au lancement d'un appel
const CallView = lazy(() =>
  import("@/components/app/CallView").then(m => ({ default: m.CallView })),
);
import { createCall } from "@/lib/calls";
import { blockUser, fetchBlockedIds } from "@/lib/moderation";
import { ReportDialog } from "@/components/app/ReportDialog";
import { useSubscription } from "@/lib/subscription";
import { fetchQuotas, quotaErrorMessage, type Quotas } from "@/lib/quotas";
import { useNavigate } from "@tanstack/react-router";

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
  photo: string | null;
  city: string | null;
  verified: boolean;
  lastSeen: string | null;
};

type MatchChat = {
  id: string;
  profile: ChatProfile;
  lastMessage: string;
  lastMessageMine: boolean;
  lastMessageRead: boolean;
  hasMessages: boolean;
  timestamp: number;
  unread: number;
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
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age > 0 && age < 120 ? age : 0;
}

function formatTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Horodatage façon messagerie : aujourd'hui → 14:32, hier → Hier, cette semaine → Mar., au-delà → 12/03 */
function formatListTime(isoString: string, now = Date.now()) {
  const date = new Date(isoString);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((startOfToday.getTime() - date.getTime()) / 86400000);

  if (dayDiff < 0) return formatTime(isoString);
  if (dayDiff === 0) return formatTime(isoString);
  if (dayDiff === 1) return "Hier";
  if (dayDiff < 7) {
    const d = date.toLocaleDateString("fr-FR", { weekday: "short" });
    return d.charAt(0).toUpperCase() + d.slice(1).replace(".", "");
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatLastSeen(isoString: string | null, now = Date.now()): { text: string; online: boolean } {
  if (!isoString) return { text: "Hors ligne", online: false };
  const diffMins = Math.floor((now - new Date(isoString).getTime()) / 60000);

  if (diffMins < 0) return { text: "En ligne", online: true };
  if (diffMins < 5) return { text: "En ligne", online: true };
  if (diffMins < 60) return { text: `Vu il y a ${diffMins} min`, online: false };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { text: `Vu il y a ${diffHours} h`, online: false };
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return { text: `Vu il y a ${diffDays} j`, online: false };
  return { text: `Vu le ${new Date(isoString).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`, online: false };
}

/** Recherche insensible à la casse ET aux accents (José ↔ jose) */
function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const MEDIA_LABELS: Record<string, string> = {
  image: "📷 Photo",
  video: "🎥 Vidéo",
  audio: "🎤 Message vocal",
  gif: "🎬 GIF",
  sticker: "✨ Sticker",
};

/** Avatar avec repli sur les initiales si la photo manque ou ne charge pas */
function ChatAvatar({
  src,
  name,
  className = "",
  textClassName = "text-sm",
}: {
  src: string | null;
  name: string;
  className?: string;
  textClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-primary/25 to-gold/25 flex items-center justify-center font-serif font-semibold text-primary ${textClassName}`}
        aria-label={name}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return <img src={src} alt={name} className={className} onError={() => setFailed(true)} />;
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

/**
 * Récupère les profils des interlocuteurs.
 * PostgREST rejette toute la requête si une seule colonne demandée n'existe pas,
 * ce qui ferait basculer tous les profils sur « Membre ». On retente donc avec
 * le jeu de colonnes minimal garanti.
 */
async function fetchChatProfiles(ids: string[]) {
  const full = await supabase
    .from("profiles")
    .select("id, first_name, birth_date, photos, city, is_verified, last_seen")
    .in("id", ids);

  if (!full.error) return full;

  console.warn("[messages] colonnes optionnelles absentes de `profiles`, repli minimal:", full.error.message);
  return supabase
    .from("profiles")
    .select("id, first_name, birth_date, photos")
    .in("id", ids);
}

// ─────────────────────────────────────────────────
// Messages Page
// ─────────────────────────────────────────────────
/** Chargement complet des conversations. Mis en cache par React Query. */
async function loadConversations(userId: string): Promise<MatchChat[]> {
  const user = { id: userId };

  // matches et blocages en parallèle : 2 rondes réseau au lieu de 3
  const [{ data: matchesData, error: matchesError }, blockedList] = await Promise.all([
    supabase
      .from("matches")
      .select("id, created_at, user1_id, user2_id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
    fetchBlockedIds(),
  ]);

  if (matchesError) console.error("[messages] matches:", matchesError);
  if (!matchesData || matchesData.length === 0) return [];

  // Les conversations avec des personnes bloquées ne s'affichent plus
  const blockedIds = new Set(blockedList);
  const visibleMatches = matchesData.filter((m: any) => {
    const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
    return !blockedIds.has(otherId);
  });

  if (visibleMatches.length === 0) return [];

  {
    {
        const otherIds = visibleMatches.map((m: any) => (m.user1_id === user.id ? m.user2_id : m.user1_id));

        const [
          { data: profiles, error: profilesError },
          { data: unreadRows, error: unreadError },
          lastMsgResults,
        ] = await Promise.all([
          fetchChatProfiles(otherIds),
          // Une seule requête pour tous les non-lus (au lieu d'une par match)
          supabase
            .from("messages")
            .select("match_id")
            .in("match_id", visibleMatches.map((m: any) => m.id))
            .neq("sender_id", user.id)
            .is("read_at", null),
          Promise.all(
            visibleMatches.map((m: any) =>
              supabase
                .from("messages")
                .select("content, created_at, sender_id, media_type, read_at")
                .eq("match_id", m.id)
                .order("created_at", { ascending: false })
                .limit(1),
            ),
          ),
        ]);

        if (profilesError) console.error("[messages] profiles:", profilesError);
        if (unreadError) console.error("[messages] unread:", unreadError);
        const lastMsgError = lastMsgResults.find(r => r.error)?.error;
        if (lastMsgError) console.error("[messages] last message:", lastMsgError);

        // Diagnostic : des matches existent mais aucun profil n'est lisible
        // → presque toujours une policy RLS SELECT trop restrictive sur `profiles`.
        if (!profilesError && (profiles?.length ?? 0) < otherIds.length) {
          console.warn(
            `[messages] ${otherIds.length} interlocuteur(s) attendu(s), ${profiles?.length ?? 0} profil(s) lisible(s).`,
            "Vérifiez la policy RLS SELECT de la table `profiles`.",
          );
        }

        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

        const unreadMap = new Map<string, number>();
        for (const row of unreadRows ?? []) {
          unreadMap.set((row as any).match_id, (unreadMap.get((row as any).match_id) ?? 0) + 1);
        }

        const formatted: MatchChat[] = visibleMatches.map((m: any, i: number) => {
          const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
          const p = profileMap.get(otherId) as any;

          const lastMsg = lastMsgResults[i].data?.[0] ?? null;
          const mine = lastMsg ? lastMsg.sender_id === user.id : false;

          let preview = "Nouveau match — dites bonjour 👋";
          if (lastMsg) {
            preview = lastMsg.media_type
              ? MEDIA_LABELS[lastMsg.media_type] || "Média"
              : lastMsg.content || "";
            // « Vous : » aussi sur les médias, pour rester cohérent
            if (mine) preview = `Vous : ${preview}`;
          }

          return {
            id: m.id,
            profile: {
              id: otherId,
              firstName: p?.first_name || "Membre",
              age: getAge(p?.birth_date ?? null),
              photo: p?.photos?.[0] ?? null,
              city: p?.city ?? null,
              verified: Boolean(p?.is_verified),
              lastSeen: p?.last_seen ?? null,
            },
            lastMessage: preview,
            lastMessageMine: mine,
            lastMessageRead: Boolean(lastMsg?.read_at),
            hasMessages: Boolean(lastMsg),
            timestamp: new Date(lastMsg?.created_at ?? m.created_at).getTime(),
            unread: unreadMap.get(m.id) ?? 0,
            typing: false,
          };
        });

        formatted.sort((a, b) => b.timestamp - a.timestamp);
        return formatted;
    }
  }
}

// ─────────────────────────────────────────────────
// Messages Page
// ─────────────────────────────────────────────────
function MessagesPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [active, setActive] = useState<MatchChat | null>(null);
  const [chats, setChats] = useState<MatchChat[]>([]);
  const userId = useCurrentUserId() ?? null;
  // Tick horaire : force le recalcul de « En ligne » / « il y a X min » sans refetch
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Le cache rend le retour sur la page instantané ; la revalidation est silencieuse
  const { data: loadedChats, isPending, isError } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => loadConversations(userId!),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (loadedChats) setChats(loadedChats);
  }, [loadedChats]);

  useEffect(() => {
    if (isError) toast.error("Impossible de charger vos conversations");
  }, [isError]);

  const loading = isPending && chats.length === 0;

  // Temps réel : un nouveau message remonte la conversation et incrémente le badge
  useEffect(() => {
    if (!userId || chats.length === 0) return;

    const knownIds = new Set(chats.map(c => c.id));
    const channel = supabase
      .channel("messages-overview")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        const msg = payload.new as Msg;
        if (!knownIds.has(msg.match_id)) return;

        const mine = msg.sender_id === userId;
        const body = msg.media_type ? MEDIA_LABELS[msg.media_type] || "Média" : msg.content || "";

        setChats(prev =>
          prev
            .map(c =>
              c.id === msg.match_id
                ? {
                    ...c,
                    lastMessage: mine ? `Vous : ${body}` : body,
                    lastMessageMine: mine,
                    lastMessageRead: false,
                    hasMessages: true,
                    timestamp: new Date(msg.created_at).getTime(),
                    // Pas de badge si la conversation est ouverte à l'écran
                    unread: mine || active?.id === msg.match_id ? c.unread : c.unread + 1,
                  }
                : c,
            )
            .sort((a, b) => b.timestamp - a.timestamp),
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, chats.length, active?.id]);

  const openChat = (c: MatchChat) => {
    // Optimiste : le badge disparaît tout de suite, ChatView écrit read_at côté serveur
    setChats(prev => prev.map(x => (x.id === c.id ? { ...x, unread: 0 } : x)));
    setActive(c);
  };

  // Ouvre directement la bonne conversation depuis /messages?conversation=<matchId>
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current || chats.length === 0) return;
    const target = new URLSearchParams(window.location.search).get("conversation");
    if (!target) return;
    const chat = chats.find(c => c.id === target);
    if (chat) {
      openedFromUrl.current = true;
      openChat(chat);
    }
  }, [chats]);

  const newMatches = useMemo(() => chats.filter(c => !c.hasMessages), [chats]);
  const conversations = useMemo(() => chats.filter(c => c.hasMessages), [chats]);
  const totalUnread = useMemo(() => chats.reduce((n, c) => n + c.unread, 0), [chats]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return conversations
      .filter(c => (tab === "unread" ? c.unread > 0 : true))
      .filter(c =>
        !q ||
        normalize(c.profile.firstName).includes(q) ||
        normalize(c.lastMessage).includes(q),
      );
  }, [query, tab, conversations]);

  if (active && userId) {
    return (
      <ChatView
        chat={active}
        currentUserId={userId}
        onBack={() => setActive(null)}
        onRead={id => setChats(prev => prev.map(c => (c.id === id ? { ...c, unread: 0 } : c)))}
      />
    );
  }

  return (
    <div className="px-4 pt-4">
      <div className="flex items-baseline gap-2 mb-3">
        <h1 className="font-serif text-2xl font-semibold">Messages</h1>
        {totalUnread > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-semibold">
            {totalUnread} non lu{totalUnread > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une conversation…"
          className="w-full pl-10 pr-9 py-2.5 rounded-full bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Effacer la recherche"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center hover:bg-muted-foreground/30"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4">
        {([["all", "Toutes"], ["unread", "Non lues"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              tab === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/70"
            }`}
          >
            {label}
            {key === "unread" && totalUnread > 0 && ` · ${totalUnread}`}
          </button>
        ))}
      </div>

      {loading ? (
        <ConversationSkeleton />
      ) : (
        <>
          {/* Nouveaux matches : uniquement ceux sans aucun message */}
          {newMatches.length > 0 && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
                Nouveaux matches · {newMatches.length}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                {newMatches.map(c => {
                  const { online } = formatLastSeen(c.profile.lastSeen, now);
                  return (
                    <button key={c.id} onClick={() => openChat(c)} className="shrink-0 flex flex-col items-center gap-1">
                      <div className="relative">
                        <div className="p-0.5 rounded-full bg-gradient-to-tr from-primary to-gold">
                          <ChatAvatar
                            src={c.profile.photo}
                            name={c.profile.firstName}
                            className="w-14 h-14 rounded-full object-cover border-2 border-background"
                            textClassName="text-lg"
                          />
                        </div>
                        {online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />}
                      </div>
                      <span className="text-[11px] font-medium max-w-[64px] truncate">{c.profile.firstName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conversations */}
          <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">Conversations</div>
          <div className="divide-y divide-border rounded-2xl overflow-hidden bg-card border border-border/50">
            {filtered.map(c => {
              const { text: lastSeenText, online } = formatLastSeen(c.profile.lastSeen, now);
              return (
                <button
                  key={c.id}
                  onClick={() => openChat(c)}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/40 transition-colors text-left"
                >
                  <div className="relative shrink-0">
                    <div className={c.unread > 0 ? "p-0.5 rounded-full bg-gradient-to-tr from-primary to-gold" : ""}>
                      <ChatAvatar
                        src={c.profile.photo}
                        name={c.profile.firstName}
                        className={`w-12 h-12 rounded-full object-cover ${c.unread > 0 ? "border-2 border-background" : ""}`}
                        textClassName="text-base"
                      />
                    </div>
                    {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold truncate flex items-center gap-1">
                        {c.profile.firstName}
                        {c.profile.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" aria-label="Profil certifié" />}
                      </span>
                      <span className={`text-[11px] shrink-0 ${c.unread > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {formatListTime(new Date(c.timestamp).toISOString(), now)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className={`text-sm truncate flex items-center gap-1 ${c.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {c.typing ? (
                          <em className="text-primary">en train d'écrire…</em>
                        ) : (
                          <>
                            {c.lastMessageMine &&
                              (c.lastMessageRead ? (
                                <CheckCheck className="w-3.5 h-3.5 shrink-0 text-primary" />
                              ) : (
                                <Check className="w-3.5 h-3.5 shrink-0" />
                              ))}
                            <span className="truncate">{c.lastMessage}</span>
                          </>
                        )}
                      </span>
                      {c.unread > 0 && (
                        <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {online ? "En ligne" : lastSeenText}
                    </div>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {query
                    ? "Aucune conversation ne correspond à votre recherche."
                    : tab === "unread"
                      ? "Vous êtes à jour, aucun message non lu 🙌"
                      : newMatches.length > 0
                        ? "Lancez la conversation avec l'un de vos nouveaux matches ✨"
                        : "Aucune conversation pour l'instant."}
                </p>
                {!query && tab === "all" && newMatches.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Allez swiper pour faire de belles rencontres !</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="divide-y divide-border rounded-2xl overflow-hidden bg-card border border-border/50">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-secondary" />
            <div className="h-3 w-2/3 rounded bg-secondary/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Chat View
// ─────────────────────────────────────────────────
function ChatView({
  chat,
  currentUserId,
  onBack,
  onRead,
  onQuotaChange,
}: {
  chat: MatchChat;
  currentUserId: string;
  onBack: () => void;
  onRead: (matchId: string) => void;
  onQuotaChange?: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showSticker, setShowSticker] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [callState, setCallState] = useState<{ type: "audio" | "video"; callId: string } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [startingCall, setStartingCall] = useState(false);
  const { features } = useSubscription();
  const navigate = useNavigate();

  const requirePlan = (message: string) =>
    toast.error(message, {
      action: { label: "Voir les formules", onClick: () => navigate({ to: "/abonnement" }) },
    });

  // Crée la ligne `calls` : c'est cet INSERT qui fait sonner chez l'autre.
  const startCall = async (type: "audio" | "video") => {
    if (startingCall) return;
    if (!features.calls) {
      requirePlan("Les appels sont réservés aux membres Premium");
      return;
    }
    if (type === "video" && !features.videoCalls) {
      requirePlan("Les appels vidéo sont réservés aux membres VIP");
      return;
    }
    setStartingCall(true);
    const call = await createCall({
      matchId: chat.id,
      callerId: currentUserId,
      calleeId: chat.profile.id,
      callType: type,
    });
    setStartingCall(false);

    if (!call) {
      toast.error("Impossible de lancer l'appel");
      return;
    }
    setCallState({ type, callId: call.id });
  };

  const presence = useMemo(() => formatLastSeen(chat.profile.lastSeen, now), [chat.profile.lastSeen, now]);

  const [quotas, setQuotas] = useState<Quotas | null>(null);
  const loadQuotas = () => fetchQuotas().then(setQuotas);
  useEffect(() => { loadQuotas(); }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioChunks = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Rafraîchit « En ligne / Vu il y a X » dans l'en-tête
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  /** Marque comme lus les messages reçus non lus de cette conversation */
  const markAsRead = async () => {
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("match_id", chat.id)
      .neq("sender_id", currentUserId)
      .is("read_at", null);

    if (error) {
      console.error("markAsRead", error);
      return;
    }
    onRead(chat.id);
  };

  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", chat.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Msg[]);
      // À l'ouverture, tout ce qui a été reçu est considéré lu
      markAsRead();
    }
    loadMessages();

    const channel = supabase.channel(`room:${chat.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `match_id=eq.${chat.id}`,
      }, (payload: any) => {
        const msg = payload.new as Msg;
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
        // Conversation ouverte → le message entrant est lu immédiatement
        if (msg.sender_id !== currentUserId) markAsRead();
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `match_id=eq.${chat.id}`,
      }, (payload: any) => {
        // Accusés de lecture : passe ✓ en ✓✓ en direct
        const msg = payload.new as Msg;
        setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, ...msg } : m)));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chat.id, currentUserId]);

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

    if (!error) {
      onQuotaChange?.();
      loadQuotas();
      return false;
    }

    // La base applique les limites de la formule Gratuit : on traduit son
    // refus plutôt que d'afficher « Erreur d'envoi », qui n'apprend rien.
    const limit = quotaErrorMessage(error);
    if (limit) {
      toast.error(limit, {
        action: { label: "Voir les formules", onClick: () => navigate({ to: "/abonnement" }) },
      });
    } else {
      toast.error("Erreur d'envoi");
    }
    return true;
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

    // Inutile de téléverser un fichier que la base refusera ensuite
    if (type === "video" && !features.videoMessages) {
      requirePlan("L'envoi de vidéos en conversation est réservé aux membres VIP");
      e.target.value = "";
      return;
    }
    setUploading(true);
    const url = await uploadMedia(file, type === "image" ? "images" : "videos");
    if (url) await sendMessage({ media_url: url, media_type: type });
    setUploading(false);
    setShowMedia(false);
    e.target.value = "";
  };

  // ── Voice recording ──
  const startRecording = async () => {
    if (!features.voiceMessages) {
      requirePlan("Les messages vocaux sont réservés aux membres Premium");
      return;
    }
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
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 bg-[#0d0d1a] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-white/60 text-sm">Appel de {chat.profile.firstName}…</p>
        </div>
      }
    >
      <CallView
        channelName={chat.id}
        callType={callState.type}
        peerName={chat.profile.firstName}
        peerPhoto={chat.profile.photo ?? ""}
        callId={callState.callId}
        role="caller"
        onEnd={() => setCallState(null)}
      />
    </Suspense>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-64px-72px)]">
      {/* Header */}
      <div className="sticky top-14 z-20 flex items-center gap-3 px-3 py-2 border-b border-border/50 bg-background/95 backdrop-blur">
        <button onClick={onBack} aria-label="Retour" className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative shrink-0">
          <ChatAvatar
            src={chat.profile.photo}
            name={chat.profile.firstName}
            className="w-10 h-10 rounded-full object-cover"
          />
          {presence.online && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate flex items-center gap-1">
            <span className="truncate">
              {chat.profile.firstName}
              {chat.profile.age > 0 && `, ${chat.profile.age}`}
            </span>
            {chat.profile.verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" aria-label="Profil certifié" />}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {chat.typing ? (
              <span className="text-primary">en train d'écrire…</span>
            ) : (
              <span className={presence.online ? "text-emerald-500" : ""}>{presence.text}</span>
            )}
          </div>
        </div>
        {/* Call buttons */}
        <button
          onClick={() => startCall("audio")}
          disabled={startingCall}
          className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center disabled:opacity-50"
          aria-label="Appel audio"
        >
          <Phone className="w-4 h-4 text-primary" />
        </button>
        <button
          onClick={() => startCall("video")}
          disabled={startingCall}
          className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center disabled:opacity-50"
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
                  {
                    l: "Signaler",
                    i: Flag,
                    action: () => setReportOpen(true),
                  },
                  {
                    l: "Bloquer",
                    i: Ban,
                    action: async () => {
                      const ok = await blockUser(chat.profile.id);
                      if (ok) {
                        toast.success(`${chat.profile.firstName} a été bloqué`);
                        onBack();
                      } else {
                        toast.error("Le blocage n'a pas pu être enregistré");
                      }
                    },
                  },
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

      {/* Quota restant — annoncé avant d'écrire, pas après le refus */}
      {quotas && quotas.messagesLeft >= 0 && (
        <div
          className={`px-3 py-1.5 text-[11px] flex items-center justify-center gap-1.5 border-t border-border/50 ${
            quotas.messagesLeft === 0 ? "bg-destructive/10 text-destructive" : "bg-secondary/50 text-muted-foreground"
          }`}
        >
          {quotas.messagesLeft === 0 ? (
            <>
              <Lock className="w-3 h-3" />
              Vous avez utilisé vos {quotas.messagesQuota} messages du jour
              <button onClick={() => navigate({ to: "/abonnement" })} className="font-semibold underline">
                Passer Premium
              </button>
            </>
          ) : (
            <>
              {quotas.messagesLeft} message{quotas.messagesLeft > 1 ? "s" : ""} restant
              {quotas.messagesLeft > 1 ? "s" : ""} aujourd'hui
            </>
          )}
        </div>
      )}

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

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        reportedId={chat.profile.id}
        reportedName={chat.profile.firstName}
        context="message"
      />
    </div>
  );
}
