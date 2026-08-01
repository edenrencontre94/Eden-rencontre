import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/lib/supabase";
import {
  Search,
  ArrowLeft,
  Send,
  Smile,
  Paperclip,
  Mic,
  Image as ImageIcon,
  Check,
  CheckCheck,
  MoreVertical,
  Archive,
  Flag,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/accueil/messages")({
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
  id: string; // match id
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
};

function getAge(birthDate: string | null) {
  if (!birthDate) return 25;
  return new Date().getFullYear() - new Date(birthDate).getFullYear();
}

function formatTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
          .from('matches')
          .select('id, created_at, user1_id, user2_id')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

        if (matchesData && matchesData.length > 0) {
          const otherIds = matchesData.map(m => m.user1_id === user.id ? m.user2_id : m.user1_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, birth_date, photos')
            .in('id', otherIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]));

          const formatted: MatchChat[] = matchesData.map(m => {
            const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
            const p = profileMap.get(otherId);
            return {
              id: m.id,
              profile: {
                id: p.id,
                firstName: p.first_name || "Membre",
                age: getAge(p.birth_date),
                photo: p.photos?.[0] || 'https://placehold.co/400x600/1a1a2e/gold?text=😊',
                lastActive: "Récemment"
              },
              lastMessage: "Cliquez pour commencer à discuter",
              time: formatTime(m.created_at),
              unread: 0,
              online: false,
              typing: false
            };
          });
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
    () =>
      chats.filter(
        (c) =>
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
          onChange={(e) => setQuery(e.target.value)}
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
            <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
              Nouveaux matches
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {chats.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c)}
                  className="shrink-0 flex flex-col items-center gap-1"
                >
                  <div className="relative">
                    <div className="p-0.5 rounded-full bg-gradient-to-tr from-primary to-gold">
                      <img
                        src={c.profile.photo}
                        alt={c.profile.firstName}
                        className="w-14 h-14 rounded-full object-cover border-2 border-background"
                      />
                    </div>
                    {c.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium max-w-[64px] truncate">{c.profile.firstName}</span>
                </button>
              ))}
              {chats.length === 0 && (
                <span className="text-sm text-muted-foreground">Pas encore de matches</span>
              )}
            </div>
          </div>

          {/* Conversations */}
          <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
            Conversations
          </div>
          <div className="divide-y divide-border rounded-2xl overflow-hidden bg-card border border-border/50">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c)}
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/40 transition-colors text-left"
              >
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
            {filtered.length === 0 && chats.length > 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Aucune conversation trouvée.</div>
            )}
            {chats.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Allez swiper pour faire des rencontres !</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ChatView({ chat, currentUserId, onBack }: { chat: MatchChat; currentUserId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', chat.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as Msg[]);
    }
    loadMessages();

    const channel = supabase.channel(`room:${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${chat.id}`
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Msg]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chat.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId,
      match_id: chat.id,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      read_at: null
    }]);

    const { error } = await supabase.from('messages').insert({
      match_id: chat.id,
      sender_id: currentUserId,
      content
    });

    if (error) {
      toast.error("Erreur d'envoi");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempId)); // Realtime will add the actual message
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-64px-72px)]">
      {/* header */}
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
        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center" aria-label="Options">
            <MoreVertical className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-11 w-48 bg-card border border-border rounded-xl shadow-elegant py-1 z-30"
              >
                {[
                  { l: "Archiver", i: Archive, action: () => toast.success("Conversation archivée") },
                  { l: "Signaler", i: Flag, action: () => toast.info("Signalement envoyé") },
                  { l: "Bloquer", i: Ban, action: () => toast.info("Utilisateur bloqué") },
                ].map((it) => (
                  <button
                    key={it.l}
                    onClick={() => { setMenu(false); it.action(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-left"
                  >
                    <it.i className="w-4 h-4" />
                    {it.l}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-secondary/20">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-10">
            Dites bonjour à {chat.profile.firstName} 👋
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-soft ${
                isMe
                  ? "bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-br-md"
                  : "bg-card border border-border/60 rounded-bl-md"
              }`}>
                <div>{m.content}</div>
                <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatTime(m.created_at)}
                  {isMe && (m.read_at ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                </div>
              </div>
            </div>
          );
        })}
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

      {/* composer */}
      <div className="border-t border-border/50 bg-background p-2 flex items-center gap-1.5">
        <button className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center" aria-label="Pièce jointe">
          <Paperclip className="w-4 h-4" />
        </button>
        <button className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center" aria-label="Photo">
          <ImageIcon className="w-4 h-4" />
        </button>
        <div className="flex-1 relative">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Écrire un message…"
            className="w-full pl-4 pr-9 py-2.5 rounded-full bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-background/70 flex items-center justify-center" aria-label="Emoji">
            <Smile className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {text ? (
          <button
            onClick={send}
            aria-label="Envoyer"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-elegant"
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-elegant" aria-label="Audio">
            <Mic className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}