import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { verseOfTheDay, weeklyChallenge, coupleTestimonials } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/accueil/communaute")({
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

type CategoryType = (typeof categories)[number];
const sorts = ["Récentes", "Populaires"] as const;

type CommunityPost = {
  id: string;
  user_id: string;
  category: string;
  text: string;
  image_url: string | null;
  likes_count: number;
  created_at: string;
  profile: {
    id: string;
    first_name: string;
    city: string | null;
    photos: string[] | null;
    is_verified: boolean | null;
    is_premium: boolean | null;
  } | null;
  liked: boolean;
  saved: boolean;
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}

function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryType>("Tous");
  const [sort, setSort] = useState<(typeof sorts)[number]>("Récentes");
  const [composer, setComposer] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: p } = await supabase.from('profiles').select('first_name, city, photos').eq('id', user.id).single();
        setCurrentUserProfile(p);
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function loadPosts() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('community_posts')
          .select(`
            id, user_id, category, text, image_url, likes_count, created_at,
            profiles!community_posts_user_id_fkey(id, first_name, city, photos, is_verified, is_premium)
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (data) {
          setPosts(data.map((p: any) => ({
            ...p,
            profile: p.profiles,
            liked: false,
            saved: false,
          })));
        }
      } catch (err) {
        console.error("Erreur chargement posts:", err);
        // Graceful fallback: empty list
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  const visible = useMemo(() => {
    let list = posts;
    if (category !== "Tous") list = list.filter((p) => p.category === category);
    if (sort === "Populaires") list = [...list].sort((a, b) => b.likes_count - a.likes_count);
    return list;
  }, [posts, category, sort]);

  const toggleLike = async (id: string) => {
    setPosts((all) =>
      all.map((p) => {
        if (p.id !== id) return p;
        const liked = !p.liked;
        return { ...p, liked, likes_count: liked ? p.likes_count + 1 : p.likes_count - 1 };
      })
    );
    // Note: Real persistence would need a post_likes table
  };

  const toggleSave = (id: string) => {
    setPosts((all) => all.map((p) => p.id !== id ? p : { ...p, saved: !p.saved }));
  };

  const publish = async () => {
    if (!composer.trim()) return;
    if (!currentUserId) { toast.error("Vous devez être connecté pour publier"); return; }
    setPublishing(true);
    try {
      const { data, error } = await supabase.from('community_posts').insert({
        user_id: currentUserId,
        category: "Réflexion",
        text: composer.trim(),
        likes_count: 0,
      }).select().single();

      if (error) throw error;

      const newPost: CommunityPost = {
        ...data,
        profile: {
          id: currentUserId,
          first_name: currentUserProfile?.first_name || "Moi",
          city: currentUserProfile?.city || null,
          photos: currentUserProfile?.photos || null,
          is_verified: false,
          is_premium: false,
        },
        liked: false,
        saved: false,
      };
      setPosts((prev) => [newPost, ...prev]);
      setComposer("");
      toast.success("Publication partagée avec la communauté ✨");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la publication");
    } finally {
      setPublishing(false);
    }
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
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
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
      <div className="rounded-2xl bg-card border border-border/50 p-3 mb-4 shadow-soft">
        <div className="flex items-start gap-3">
          <img
            src={currentUserProfile?.photos?.[0] || "https://placehold.co/100/1a1a2e/gold?text=😊"}
            alt="Moi"
            className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-1"
          />
          <div className="flex-1">
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Partagez un témoignage, une prière, un verset…"
              rows={2}
              maxLength={800}
              className="w-full resize-none bg-transparent focus:outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
          <button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <ImageIcon className="w-4 h-4" /> Ajouter une photo
          </button>
          <button
            onClick={publish}
            disabled={!composer.trim() || publishing}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-medium shadow-elegant disabled:opacity-40 disabled:shadow-none transition-opacity"
          >
            {publishing ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Publier
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
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
              sort === s ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-secondary/40 animate-pulse h-36" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          Aucune publication pour l'instant. Soyez le premier à partager !
        </div>
      ) : (
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
                <img
                  src={p.profile?.photos?.[0] || "https://placehold.co/100/1a1a2e/gold?text=😊"}
                  alt={p.profile?.first_name || "Membre"}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm truncate">{p.profile?.first_name || "Membre"}</span>
                    {p.profile?.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                    {p.profile?.is_premium && <Crown className="w-3.5 h-3.5 text-gold shrink-0" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {timeAgo(p.created_at)} · {p.profile?.city || ""}
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-primary font-semibold">
                  {p.category}
                </span>
              </header>
              <div className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-line">{p.text}</div>
              {p.image_url && (
                <div className="max-h-96 overflow-hidden">
                  <img src={p.image_url} alt="" className="w-full object-cover" />
                </div>
              )}
              <footer className="grid grid-cols-5 divide-x divide-border/50 border-t border-border/50">
                <PostAction
                  icon={Heart}
                  label={String(p.likes_count)}
                  active={p.liked}
                  activeClass="text-red-500"
                  onClick={() => toggleLike(p.id)}
                  fillWhenActive
                />
                <PostAction icon={MessageCircle} label="0" onClick={() => toast.info("Commentaires bientôt disponibles")} />
                <PostAction icon={Share2} label="Partager" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Lien copié"); }} />
                <PostAction
                  icon={Bookmark}
                  label={p.saved ? "Sauvé" : "Sauver"}
                  active={p.saved}
                  activeClass="text-primary"
                  onClick={() => toggleSave(p.id)}
                  fillWhenActive
                />
                <PostAction icon={Flag} label="" onClick={() => toast.info("Signalement envoyé")} />
              </footer>
            </motion.article>
          ))}
        </div>
      )}
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