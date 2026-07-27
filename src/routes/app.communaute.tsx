import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Flag,
  BookOpen,
  Flame,
  Sparkles,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  Crown,
} from "lucide-react";
import {
  posts as seedPosts,
  coupleTestimonials,
  verseOfTheDay,
  weeklyChallenge,
  type Post,
} from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/communaute")({
  head: () => ({
    meta: [
      { title: "Communauté — AgapeMeet" },
      { name: "description", content: "Témoignages, prières, encouragements et versets." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CommunityPage,
});

const categories = [
  "Tous",
  "Témoignage",
  "Prière",
  "Encouragement",
  "Verset",
  "Conseil",
  "Réflexion",
  "Question",
  "Expérience",
] as const;

const sorts = ["Récentes", "Populaires"] as const;

function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>(seedPosts);
  const [category, setCategory] = useState<(typeof categories)[number]>("Tous");
  const [sort, setSort] = useState<(typeof sorts)[number]>("Récentes");
  const [composer, setComposer] = useState("");

  const visible = useMemo(() => {
    let list = posts;
    if (category !== "Tous") list = list.filter((p) => p.category === category);
    if (sort === "Populaires") list = [...list].sort((a, b) => b.likes - a.likes);
    return list;
  }, [posts, category, sort]);

  const toggle = (id: string, key: "liked" | "saved") =>
    setPosts((all) =>
      all.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, [key]: !p[key] };
        if (key === "liked") next.likes = next.liked ? p.likes + 1 : p.likes - 1;
        return next;
      }),
    );

  const publish = () => {
    if (!composer.trim()) return;
    const newPost: Post = {
      id: `me-${Date.now()}`,
      author: seedPosts[0].author,
      category: "Réflexion",
      time: "À l'instant",
      text: composer.trim(),
      likes: 0,
      comments: 0,
      shares: 0,
    };
    setPosts((p) => [newPost, ...p]);
    setComposer("");
    toast.success("Publication partagée avec la communauté");
  };

  return (
    <div className="px-4 pt-4">
      <h1 className="font-serif text-2xl font-semibold">Communauté</h1>
      <p className="text-xs text-muted-foreground mb-4">Ensemble, grandissons dans la foi.</p>

      {/* Verset du jour */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-5 mb-4 relative overflow-hidden text-white shadow-elegant"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70" />
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest font-semibold text-gold">
            <BookOpen className="w-3.5 h-3.5" /> Verset du jour
          </span>
          <p className="font-serif text-lg italic mt-2 leading-snug">« {verseOfTheDay.text} »</p>
          <p className="text-xs opacity-90 mt-2 font-medium">— {verseOfTheDay.ref}</p>
        </div>
      </motion.div>

      {/* Défi hebdo */}
      <div className="rounded-2xl bg-gold-soft border border-gold/30 p-4 mb-5 flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-gold text-gold-foreground flex items-center justify-center shadow-soft">
          <Flame className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-gold-foreground/80">
            {weeklyChallenge.title}
          </div>
          <div className="text-sm font-medium mt-0.5">{weeklyChallenge.text}</div>
        </div>
      </div>

      {/* Testimonials couples */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-serif text-lg font-semibold">Couples AgapeMeet</h3>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          {coupleTestimonials.map((c) => (
            <div key={c.id} className="shrink-0 w-64 rounded-2xl overflow-hidden bg-card border border-border/50 shadow-soft">
              <div className="aspect-[4/3]">
                <img src={c.photo} alt={c.names} className="w-full h-full object-cover" />
              </div>
              <div className="p-3">
                <div className="font-serif font-semibold">{c.names}</div>
                <div className="text-[11px] text-muted-foreground">{c.city}</div>
                <p className="text-xs mt-1.5 leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="rounded-2xl bg-card border border-border/50 p-3 mb-4">
        <textarea
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          placeholder="Partagez un témoignage, une prière, un verset…"
          rows={2}
          maxLength={800}
          className="w-full resize-none bg-transparent focus:outline-none text-sm"
        />
        <div className="flex items-center justify-between mt-2">
          <button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
            <ImageIcon className="w-4 h-4" /> Ajouter une photo
          </button>
          <button
            onClick={publish}
            disabled={!composer.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-medium shadow-elegant disabled:opacity-40 disabled:shadow-none"
          >
            <Send className="w-3.5 h-3.5" /> Publier
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-3 scrollbar-none">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
              category === c
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-foreground/80 hover:border-primary/40"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {sorts.map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              sort === s ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {visible.map((p, i) => (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-2xl bg-card border border-border/50 shadow-soft overflow-hidden"
          >
            <header className="flex items-center gap-3 p-3">
              <img src={p.author.photo} alt={p.author.firstName} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate">{p.author.firstName}</span>
                  {p.author.verified && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                  {p.author.premium && <Crown className="w-3.5 h-3.5 text-gold shrink-0" />}
                </div>
                <div className="text-[11px] text-muted-foreground">{p.time} · {p.author.city}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-primary font-semibold">
                {p.category}
              </span>
            </header>
            <div className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-line">{p.text}</div>
            {p.image && (
              <div className="max-h-96 overflow-hidden">
                <img src={p.image} alt="" className="w-full object-cover" />
              </div>
            )}
            <footer className="grid grid-cols-5 divide-x divide-border/50 border-t border-border/50">
              <PostAction
                icon={Heart}
                label={String(p.likes)}
                active={p.liked}
                activeClass="text-red-500"
                onClick={() => toggle(p.id, "liked")}
                fillWhenActive
              />
              <PostAction icon={MessageCircle} label={String(p.comments)} onClick={() => toast.info("Commentaires bientôt disponibles")} />
              <PostAction icon={Share2} label="Partager" onClick={() => toast.success("Lien copié")} />
              <PostAction
                icon={Bookmark}
                label={p.saved ? "Sauvé" : "Sauver"}
                active={p.saved}
                activeClass="text-primary"
                onClick={() => toggle(p.id, "saved")}
                fillWhenActive
              />
              <PostAction icon={Flag} label="" onClick={() => toast.info("Signalement envoyé")} />
            </footer>
          </motion.article>
        ))}
      </div>
    </div>
  );
}

function PostAction({
  icon: Icon,
  label,
  onClick,
  active,
  activeClass = "",
  fillWhenActive,
}: {
  icon: typeof Heart;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
  fillWhenActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium hover:bg-secondary/60 transition-colors ${
        active ? activeClass : "text-muted-foreground"
      }`}
    >
      <Icon className="w-4 h-4" fill={active && fillWhenActive ? "currentColor" : "none"} />
      {label && <span>{label}</span>}
    </button>
  );
}