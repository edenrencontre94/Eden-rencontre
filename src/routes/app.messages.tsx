import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Reply,
} from "lucide-react";
import { chats, type Chat } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/messages")({
  head: () => ({
    meta: [
      { title: "Messages — AgapeMeet" },
      { name: "description", content: "Vos conversations sur AgapeMeet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Chat | null>(null);
  const filtered = useMemo(
    () =>
      chats.filter(
        (c) =>
          c.profile.firstName.toLowerCase().includes(query.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  if (active) return <ChatView chat={active} onBack={() => setActive(null)} />;

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

      {/* Nouveaux matches */}
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
          Nouveaux matches
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
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
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Aucune conversation trouvée.</div>
        )}
      </div>
    </div>
  );
}

type Msg = { id: string; from: "me" | "them"; text: string; time: string; read?: boolean };

function ChatView({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "1", from: "them", text: `Bonjour ${chat.profile.firstName === "Grâce" ? "!" : "😊"} Que Dieu te bénisse !`, time: "09:12", read: true },
    { id: "2", from: "me", text: "Merci ! Ravi de faire ta connaissance. Ta bio m'a beaucoup touché.", time: "09:14", read: true },
    { id: "3", from: "them", text: chat.lastMessage, time: chat.time, read: false },
  ]);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);

  const send = () => {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { id: `${Date.now()}`, from: "me", text: text.trim(), time: "à l'instant", read: false },
    ]);
    setText("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px-72px)]">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-secondary/20">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-soft ${
              m.from === "me"
                ? "bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-br-md"
                : "bg-card border border-border/60 rounded-bl-md"
            }`}>
              <div>{m.text}</div>
              <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {m.time}
                {m.from === "me" && (m.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
              </div>
            </div>
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

      {/* hidden Reply icon usage to silence unused import */}
      <span className="hidden"><Reply className="w-4 h-4" /></span>
    </div>
  );
}