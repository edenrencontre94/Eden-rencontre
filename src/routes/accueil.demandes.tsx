import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Heart,
  Star,
  Sparkles,
  Eye,
  Check,
  X,
  Flag,
  Ban,
  Lock,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useSubscription } from "@/lib/subscription";

export const Route = createFileRoute("/accueil/demandes")({
  head: () => ({
    meta: [
      { title: "Demandes — AgapeMeet" },
      { name: "description", content: "Vos likes, super likes et matches." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

type LikeEntry = {
  id: string;
  swiper_id: string;
  action: "like" | "superlike";
  created_at: string;
  profile: {
    id: string;
    first_name: string;
    birth_date: string | null;
    city: string | null;
    photos: string[] | null;
  };
};

type MatchEntry = {
  id: string;
  created_at: string;
  other: {
    id: string;
    first_name: string;
    birth_date: string | null;
    city: string | null;
    photos: string[] | null;
  };
};

const tabs = [
  { id: "like", label: "M'ont aimé", icon: Heart },
  { id: "superlike", label: "Super Likes", icon: Star },
  { id: "match", label: "Matches", icon: Sparkles },
  { id: "visit", label: "Visiteurs", icon: Eye, premium: true },
] as const;

type TabId = (typeof tabs)[number]["id"];

function getAge(birthDate: string | null) {
  if (!birthDate) return 25;
  return new Date().getFullYear() - new Date(birthDate).getFullYear();
}

function RequestsPage() {
  const [active, setActive] = useState<TabId>("like");
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [superlikes, setSuperlikes] = useState<LikeEntry[]>([]);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { features } = useSubscription();
  const navigate = useNavigate();
  const isPremiumLocked = active === "visit" && !features.visitors;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Charger les likes / superlikes reçus
        const { data: swipesData } = await supabase
          .from("swipes")
          .select("id, swiper_id, action, created_at, profiles!swipes_swiper_id_fkey(id, first_name, birth_date, city, photos)")
          .eq("target_id", user.id)
          .in("action", ["like", "superlike"])
          .order("created_at", { ascending: false });

        if (swipesData) {
          const all = swipesData.map((s: any) => ({
            id: s.id,
            swiper_id: s.swiper_id,
            action: s.action,
            created_at: s.created_at,
            profile: s.profiles,
          }));
          setLikes(all.filter((s) => s.action === "like"));
          setSuperlikes(all.filter((s) => s.action === "superlike"));
        }

        // Charger les matches
        const { data: matchesData } = await supabase
          .from("matches")
          .select("id, created_at, user1_id, user2_id")
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (matchesData && matchesData.length > 0) {
          const otherIds = matchesData.map((m: any) =>
            m.user1_id === user.id ? m.user2_id : m.user1_id
          );
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, first_name, birth_date, city, photos")
            .in("id", otherIds);

          const profileMap = new Map(profilesData?.map((p: any) => [p.id, p]));
          setMatches(matchesData.map((m: any) => {
            const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
            return { id: m.id, created_at: m.created_at, other: profileMap.get(otherId) };
          }));
        }
      } catch (err) {
        console.error("Erreur chargement demandes:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const acceptLike = async (entry: LikeEntry) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("swipes").insert({
        swiper_id: user.id,
        target_id: entry.swiper_id,
        action: "like",
      });
      toast.success(`Vous avez liké ${entry.profile.first_name} — vérifiez vos matches ! 🎉`);
      setLikes((prev) => prev.filter((l) => l.id !== entry.id));
      setSuperlikes((prev) => prev.filter((l) => l.id !== entry.id));
    } catch (e) {
      toast.error("Erreur lors de l'action");
    }
  };

  const dismissLike = (id: string) => {
    setLikes((prev) => prev.filter((l) => l.id !== id));
    setSuperlikes((prev) => prev.filter((l) => l.id !== id));
    toast.info("Refusé");
  };

  const currentList = active === "like" ? likes : active === "superlike" ? superlikes : [];
  const showMatches = active === "match";

  return (
    <div className="px-4 pt-4">
      <h1 className="font-serif text-2xl font-semibold">Demandes</h1>
      <p className="text-xs text-muted-foreground mb-4">
        Consultez qui s'intéresse à votre profil.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-none">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all ${
                on
                  ? "bg-primary text-primary-foreground border-primary shadow-elegant"
                  : "bg-background text-foreground border-border hover:border-primary/40"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : isPremiumLocked ? (
        <PremiumGate />
      ) : showMatches ? (
        matches.length === 0 ? (
          <EmptyState message="Pas encore de match. Continuez à swiper !" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {matches.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl overflow-hidden bg-card border border-border/50 shadow-soft cursor-pointer"
                onClick={() => navigate({ to: "/accueil/messages" })}
              >
                <div className="relative aspect-[3/4]">
                  <img
                    src={m.other?.photos?.[0] || "https://placehold.co/400x600/1a1a2e/gold?text=😊"}
                    alt={m.other?.first_name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                    <Sparkles className="w-3 h-3" /> Match !
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                    <div className="font-serif text-base font-semibold leading-none">
                      {m.other?.first_name}, {getAge(m.other?.birth_date || null)}
                    </div>
                    <div className="text-[10px] opacity-90 mt-0.5">{m.other?.city}</div>
                  </div>
                </div>
                <div className="p-2.5 border-t border-border/60">
                  <button className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold">
                    <MessageCircle className="w-3.5 h-3.5" /> Envoyer un message
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      ) : currentList.length === 0 ? (
        <EmptyState message="Rien à afficher ici pour l'instant." />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {currentList.map((r, i) => (
            <LikeCard key={r.id} entry={r} delay={i * 0.03} onAccept={acceptLike} onDismiss={dismissLike} />
          ))}
        </div>
      )}
    </div>
  );
}

function LikeCard({
  entry,
  delay,
  onAccept,
  onDismiss,
}: {
  entry: LikeEntry;
  delay: number;
  onAccept: (e: LikeEntry) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl overflow-hidden bg-card border border-border/50 shadow-soft"
    >
      <div className="relative aspect-[3/4]">
        <img
          src={entry.profile?.photos?.[0] || "https://placehold.co/400x600/1a1a2e/gold?text=😊"}
          alt={entry.profile?.first_name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {entry.action === "superlike" && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow-soft">
            <Star className="w-3 h-3" fill="currentColor" /> Super Like
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
          <div className="font-serif text-base font-semibold leading-none">
            {entry.profile?.first_name}, {getAge(entry.profile?.birth_date || null)}
          </div>
          <div className="text-[10px] opacity-90 mt-0.5">{entry.profile?.city}</div>
        </div>
      </div>
      <div className="grid grid-cols-4 divide-x divide-border/60 border-t border-border/60">
        <button aria-label="Accepter" onClick={() => onAccept(entry)} className="py-2.5 flex items-center justify-center hover:bg-secondary/60 transition-colors text-emerald-500">
          <Check className="w-4 h-4" />
        </button>
        <button aria-label="Refuser" onClick={() => onDismiss(entry.id)} className="py-2.5 flex items-center justify-center hover:bg-secondary/60 transition-colors text-destructive">
          <X className="w-4 h-4" />
        </button>
        <button aria-label="Signaler" onClick={() => toast.info("Signalement envoyé")} className="py-2.5 flex items-center justify-center hover:bg-secondary/60 transition-colors text-muted-foreground">
          <Flag className="w-4 h-4" />
        </button>
        <button aria-label="Bloquer" onClick={() => { onDismiss(entry.id); toast.info("Bloqué"); }} className="py-2.5 flex items-center justify-center hover:bg-secondary/60 transition-colors text-muted-foreground">
          <Ban className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function PremiumGate() {
  return (
    <div className="rounded-3xl overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/85 to-primary/70" />
      <div className="relative p-8 text-center text-primary-foreground">
        <div className="w-14 h-14 rounded-full bg-gold text-gold-foreground mx-auto flex items-center justify-center shadow-elegant">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="font-serif text-2xl mt-4">Fonctionnalité Alliance</h3>
        <p className="text-sm opacity-90 mt-2 max-w-sm mx-auto">
          Passez Alliance pour voir qui a visité votre profil et accéder à toutes les fonctionnalités avancées.
        </p>
        <Link
          to="/accueil/abonnement"
          className="mt-5 inline-flex px-6 py-2.5 rounded-full bg-gold text-gold-foreground font-semibold shadow-elegant"
        >
          Devenir Alliance
        </Link>
      </div>
    </div>
  );
}