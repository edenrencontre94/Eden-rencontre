import { createFileRoute } from "@tanstack/react-router";
import { motion, useMotionValue, useTransform, AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import {
  X,
  Heart,
  Star,
  Undo2,
  Zap,
  CheckCircle2,
  Crown,
  MapPin,
  Church,
  BookOpen,
  Briefcase,
  GraduationCap,
  Ruler,
  Languages,
  Info,
} from "lucide-react";
import { profiles, type Profile } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/decouvrir")({
  head: () => ({
    meta: [
      { title: "Découvrir — AgapeMeet" },
      { name: "description", content: "Swipez et découvrez des profils compatibles." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const deck = useMemo(() => profiles.slice(0, 12), []);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ id: string; action: string }[]>([]);
  const [detail, setDetail] = useState<Profile | null>(null);

  const current = deck[index];
  const next = deck[index + 1];

  const swipe = (action: "left" | "right" | "super") => {
    if (!current) return;
    setHistory((h) => [...h, { id: current.id, action }]);
    if (action === "right") toast.success(`Vous aimez ${current.firstName}`);
    if (action === "super") toast.success(`Super Like envoyé à ${current.firstName} ⭐`);
    setIndex((i) => i + 1);
  };

  const rewind = () => {
    if (history.length === 0) {
      toast.info("Rien à annuler");
      return;
    }
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    toast.info("Action annulée");
  };

  const boost = () => toast.success("Boost activé pour 30 minutes ⚡");

  return (
    <div className="px-4 pt-4">
      <div className="text-center mb-4">
        <h1 className="font-serif text-2xl font-semibold">Découvrir</h1>
        <p className="text-xs text-muted-foreground">Trouvez votre âme sœur, un swipe à la fois</p>
      </div>

      <div className="relative h-[560px] max-h-[70vh] w-full mx-auto max-w-md">
        {!current ? (
          <EmptyDeck onReset={() => { setIndex(0); setHistory([]); }} />
        ) : (
          <>
            {next && <CardShell profile={next} scale={0.95} y={12} muted />}
            <SwipeCard
              key={current.id}
              profile={current}
              onSwipe={swipe}
              onDetail={() => setDetail(current)}
            />
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <ActionBtn label="Retour" onClick={rewind} className="bg-background border border-border text-amber-600" size="sm">
          <Undo2 className="w-4 h-4" />
        </ActionBtn>
        <ActionBtn label="Passer" onClick={() => swipe("left")} className="bg-background border border-border text-destructive">
          <X className="w-6 h-6" />
        </ActionBtn>
        <ActionBtn label="Super Like" onClick={() => swipe("super")} className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-elegant" size="lg">
          <Star className="w-6 h-6" fill="currentColor" />
        </ActionBtn>
        <ActionBtn label="J'aime" onClick={() => swipe("right")} className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-elegant">
          <Heart className="w-6 h-6" fill="currentColor" />
        </ActionBtn>
        <ActionBtn label="Boost" onClick={boost} className="bg-background border border-border text-gold" size="sm">
          <Zap className="w-4 h-4" />
        </ActionBtn>
      </div>

      <AnimatePresence>
        {detail && <ProfileSheet profile={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  label,
  className = "",
  size = "md",
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const s = size === "sm" ? "w-11 h-11" : size === "lg" ? "w-16 h-16" : "w-14 h-14";
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`${s} rounded-full flex items-center justify-center shadow-soft hover:scale-105 active:scale-95 transition-transform ${className}`}
    >
      {children}
    </button>
  );
}

function CardShell({ profile, scale = 1, y = 0, muted = false }: { profile: Profile; scale?: number; y?: number; muted?: boolean }) {
  return (
    <div
      className="absolute inset-0 rounded-3xl overflow-hidden shadow-elegant"
      style={{ transform: `scale(${scale}) translateY(${y}px)`, opacity: muted ? 0.7 : 1 }}
    >
      <img src={profile.photo} alt={profile.firstName} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
    </div>
  );
}

function SwipeCard({
  profile,
  onSwipe,
  onDetail,
}: {
  profile: Profile;
  onSwipe: (a: "left" | "right" | "super") => void;
  onDetail: () => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const likeOpacity = useTransform(x, [0, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, 0], [1, 0]);
  const superOpacity = useTransform(y, [-120, 0], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0 rounded-3xl overflow-hidden shadow-elegant bg-card cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag
      dragElastic={0.6}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 130) onSwipe("right");
        else if (info.offset.x < -130) onSwipe("left");
        else if (info.offset.y < -130) onSwipe("super");
      }}
      whileTap={{ cursor: "grabbing" }}
    >
      <img
        src={profile.photo}
        alt={profile.firstName}
        className="w-full h-full object-cover pointer-events-none select-none"
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20 pointer-events-none" />

      {/* Overlay labels */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-8 left-6 px-4 py-1.5 rounded-lg border-4 border-emerald-500 text-emerald-500 font-bold text-2xl -rotate-12 pointer-events-none"
      >
        J'AIME
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-8 right-6 px-4 py-1.5 rounded-lg border-4 border-destructive text-destructive font-bold text-2xl rotate-12 pointer-events-none"
      >
        NON
      </motion.div>
      <motion.div
        style={{ opacity: superOpacity }}
        className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-lg border-4 border-primary text-primary font-bold text-2xl pointer-events-none"
      >
        SUPER
      </motion.div>

      {/* Top badges */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex flex-col gap-1.5">
          {profile.verified && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/95 backdrop-blur text-xs font-semibold text-primary shadow-soft">
              <CheckCircle2 className="w-3.5 h-3.5" /> Vérifié
            </span>
          )}
          {profile.premium && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold text-gold-foreground text-xs font-semibold shadow-soft">
              <Crown className="w-3.5 h-3.5" /> N° 1
            </span>
          )}
        </div>
        <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-elegant">
          {profile.compatibility}%
        </span>
      </div>

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <div className="flex items-baseline gap-2">
          <h2 className="font-serif text-3xl font-semibold">{profile.firstName}</h2>
          <span className="text-xl opacity-90">{profile.age}</span>
        </div>
        <div className="flex items-center gap-3 text-sm opacity-90 mt-1">
          <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.city}</span>
          <span className="inline-flex items-center gap-1"><Church className="w-3.5 h-3.5" />{profile.denomination}</span>
        </div>
        <p className="text-sm opacity-90 mt-2 line-clamp-2">{profile.bio}</p>
        <button
          onClick={onDetail}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs font-medium hover:bg-white/25 transition-colors"
        >
          <Info className="w-3.5 h-3.5" /> Voir le profil complet
        </button>
      </div>
    </motion.div>
  );
}

function EmptyDeck({ onReset }: { onReset: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center rounded-3xl border-2 border-dashed border-border p-8">
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
        <Heart className="w-8 h-8 text-primary" />
      </div>
      <h3 className="font-serif text-xl">Plus de profils pour l'instant</h3>
      <p className="text-sm text-muted-foreground mt-1">Revenez plus tard ou élargissez vos critères.</p>
      <button
        onClick={onReset}
        className="mt-5 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-elegant"
      >
        Recommencer
      </button>
    </div>
  );
}

function ProfileSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-card rounded-t-3xl sm:rounded-3xl shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gallery */}
        <div className="flex gap-1 overflow-x-auto snap-x snap-mandatory">
          {profile.photos.map((p, i) => (
            <img key={i} src={p} alt="" className="w-full snap-start shrink-0 aspect-[4/5] object-cover" />
          ))}
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-semibold">
                  {profile.firstName}, {profile.age}
                </h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {profile.city}, {profile.country}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {profile.compatibility}%
              </span>
            </div>
          </div>

          <p className="text-sm leading-relaxed">{profile.bio}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow icon={Briefcase} label="Profession" value={profile.profession} />
            <InfoRow icon={GraduationCap} label="Études" value={profile.education} />
            <InfoRow icon={Ruler} label="Taille" value={profile.height} />
            <InfoRow icon={Languages} label="Langues" value={profile.languages.join(", ")} />
          </div>

          <ChipRow title="Centres d'intérêt" items={profile.interests} />
          <ChipRow title="Passions" items={profile.passions} />

          <Section title="Vision du mariage">{profile.marriageVision}</Section>
          <Section title="Verset préféré">
            <span className="inline-flex items-center gap-2 text-primary font-medium">
              <BookOpen className="w-4 h-4" />
              {profile.favoriteVerse}
            </span>
          </Section>
          <Section title="Église fréquentée">{profile.church}</Section>
          <Section title="Importance de la foi">{profile.faithImportance}</Section>

          <div className="rounded-2xl bg-secondary/50 border border-border/50 p-4">
            <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
              Compatibilité détaillée
            </div>
            {[
              { l: "Valeurs spirituelles", v: 92 },
              { l: "Vision du mariage", v: 85 },
              { l: "Centres d'intérêt", v: 74 },
              { l: "Mode de vie", v: 80 },
            ].map((row) => (
              <div key={row.l} className="mb-2 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span>{row.l}</span>
                  <span className="font-semibold">{row.v}%</span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${row.v}%` }} />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-full bg-primary text-primary-foreground font-medium shadow-elegant"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-secondary/40 p-3">
      <Icon className="w-4 h-4 text-primary mt-0.5" />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}

function ChipRow({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className="px-3 py-1 rounded-full bg-secondary text-xs font-medium">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-1">{title}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}