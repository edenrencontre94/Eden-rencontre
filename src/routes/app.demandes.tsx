import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Heart,
  Star,
  Sparkles,
  MessageSquare,
  Eye,
  Clock,
  Check,
  X,
  Flag,
  Ban,
  Lock,
} from "lucide-react";
import { requests, type MatchRequest } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/demandes")({
  head: () => ({
    meta: [
      { title: "Demandes — AgapeMeet" },
      { name: "description", content: "Vos likes, super likes, matches et visiteurs." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

const tabs = [
  { id: "like", label: "M'ont aimé", icon: Heart },
  { id: "superlike", label: "Super Likes", icon: Star },
  { id: "match", label: "Matches", icon: Sparkles },
  { id: "invite", label: "Invitations", icon: MessageSquare },
  { id: "visit", label: "Visiteurs", icon: Eye, premium: true },
  { id: "pending", label: "En attente", icon: Clock },
] as const;

type TabId = (typeof tabs)[number]["id"];

function RequestsPage() {
  const [active, setActive] = useState<TabId>("like");
  const list = useMemo(() => requests.filter((r) => r.type === active), [active]);
  const isPremiumLocked = active === "visit";

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

      {isPremiumLocked ? (
        <PremiumGate />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Rien à afficher ici pour l'instant.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {list.map((r, i) => (
            <RequestCard key={r.id} req={r} delay={i * 0.03} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ req, delay }: { req: MatchRequest; delay: number }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl overflow-hidden bg-card border border-border/50 shadow-soft"
    >
      <div className="relative aspect-[3/4]">
        <img src={req.profile.photo} alt={req.profile.firstName} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {req.type === "superlike" && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow-soft">
            <Star className="w-3 h-3" fill="currentColor" /> Super Like
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
          <div className="font-serif text-base font-semibold leading-none">
            {req.profile.firstName}, {req.profile.age}
          </div>
          <div className="text-[10px] opacity-90 mt-0.5">{req.profile.city} · {req.time}</div>
        </div>
      </div>
      <div className="grid grid-cols-4 divide-x divide-border/60 border-t border-border/60">
        <IconAction label="Accepter" icon={Check} onClick={() => { toast.success(`Vous avez accepté ${req.profile.firstName}`); setHidden(true); }} className="text-emerald-600" />
        <IconAction label="Refuser" icon={X} onClick={() => { toast.info("Refusé"); setHidden(true); }} className="text-destructive" />
        <IconAction label="Signaler" icon={Flag} onClick={() => toast.info("Signalement envoyé")} />
        <IconAction label="Bloquer" icon={Ban} onClick={() => { toast.info("Bloqué"); setHidden(true); }} />
      </div>
    </motion.div>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  className = "",
}: {
  icon: typeof Check;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`py-2.5 flex items-center justify-center hover:bg-secondary/60 transition-colors ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
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
        <h3 className="font-serif text-2xl mt-4">Fonctionnalité Premium</h3>
        <p className="text-sm opacity-90 mt-2 max-w-sm mx-auto">
          Passez Premium pour voir qui a visité votre profil et accéder à toutes les fonctionnalités avancées.
        </p>
        <button
          onClick={() => toast.info("Bientôt disponible")}
          className="mt-5 inline-flex px-6 py-2.5 rounded-full bg-gold text-gold-foreground font-semibold shadow-elegant"
        >
          Devenir Premium
        </button>
      </div>
    </div>
  );
}