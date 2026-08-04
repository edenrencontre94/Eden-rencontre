import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Crown, UserPlus, ArrowRight, Eye, BookOpen, Compass, Pause, Users, HeartHandshake, X, CheckCircle2, Church } from "lucide-react";
import { ProfileCard } from "@/components/app/ProfileCard";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { type Profile } from "@/lib/mock-data";
import { getCountryCode } from "@/lib/utils";
import { useDailyContent } from "@/hooks/useDailyContent";
import { boostedFirst, excludePaused, fetchAdmirerIds, filterByVisibility } from "@/lib/visibility";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/accueil")({
  head: () => ({
    meta: [
      { title: "Accueil — AgapeMeet" },
      { name: "description", content: "Vos profils recommandés et suggestions du jour sur AgapeMeet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomePage,
});

type Section = { title: string; icon: typeof Sparkles; data: Profile[]; hue?: string };

function HomePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [completionScore, setCompletionScore] = useState(0);
  const [visibility, setVisibility] = useState<"tous" | "demande" | "pause">("tous");
  const [visitors, setVisitors] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const { content: dailyContent, loading: dailyLoading } = useDailyContent();

  useEffect(() => {
    async function loadProfiles() {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        // Ronde 1 : profil, visites et admirateurs sont indépendants
        const [{ data: currentUserData }, { data: visits }, admirerIds] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('profile_visits').select('visitor_id, created_at').eq('visited_id', user.id).order('created_at', { ascending: false }).limit(5),
          fetchAdmirerIds(user.id),
        ]);

        const admirers = new Set(admirerIds);

        if (currentUserData) {
          setCurrentUser(currentUserData);
          
          // Calculate profile completion
          const fields = [
            currentUserData.first_name, currentUserData.last_name, currentUserData.bio,
            currentUserData.city, currentUserData.country, currentUserData.birth_date,
            currentUserData.gender, currentUserData.denomination, currentUserData.practice_level,
            currentUserData.baptized, currentUserData.church_attendance, currentUserData.seeking_gender,
            currentUserData.marriage_intent, currentUserData.has_children, currentUserData.wants_children
          ];
          const filled = fields.filter(f => f && f.toString().trim() !== '' && f !== 'all').length;
          const photoBonus = (currentUserData.photos && currentUserData.photos.length > 0) ? 2 : 0;
          const totalFields = fields.length + 2;
          
          setCompletionScore(Math.round(((filled + photoBonus) / totalFields) * 100));
          if (currentUserData.visibility) {
            setVisibility(currentUserData.visibility as any);
          }
        }

        let query = supabase.from('profiles').select('*').neq('id', user.id).limit(50);

        // Respecte le réglage de visibilité de chacun
        query = excludePaused(query);

        if (currentUserData && currentUserData.seeking_gender && currentUserData.seeking_gender !== "all") {
          query = query.eq('gender', currentUserData.seeking_gender);
        }

        // Ronde 2 : le deck et les profils des visiteurs partent ensemble
        const visitorIds = (visits ?? []).map((v: any) => v.visitor_id);
        const [{ data }, { data: visitorProfiles }] = await Promise.all([
          query,
          visitorIds.length > 0
            ? supabase.from('profiles').select('*').in('id', visitorIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (data) {
          const visible = boostedFirst(filterByVisibility(data as any[], admirers));
          const formatted: Profile[] = visible.map((p: any) => ({
            id: p.id,
            firstName: p.first_name || "Membre",
            age: p.birth_date ? new Date().getFullYear() - new Date(p.birth_date).getFullYear() : 25,
            city: p.city || "Ville inconnue",
            country: p.country || "",
            denomination: p.denomination || "Non précisé",
            compatibility: Math.floor(Math.random() * 20) + 80,
            verified: true,
            premium: false,
            lastActive: "Récemment",
            photo: p.photos && p.photos.length > 0 ? p.photos[0] : 'https://placehold.co/400x600/1a1a2e/gold?text=😊',
            photos: p.photos || [],
            bio: p.bio || "Pas de bio.",
            profession: "Profession non précisée",
            education: "Études",
            height: "1m70",
            languages: ["Français"],
            interests: [],
            passions: [],
            marriageVision: p.marriage_intent || "",
            favoriteVerse: "",
            church: p.church_attendance || "",
            faithImportance: p.practice_level || ""
          }));
          setProfiles(formatted);
          
          // Visiteurs : déjà chargés plus haut, plus aucune requête ici
          if (visits && visits.length > 0) {
            if (visitorProfiles) {
              const formattedVisitors = visits.map((v: any) => {
                const p = visitorProfiles.find((vp: any) => vp.id === v.visitor_id);
                return p ? {
                  id: p.id,
                  firstName: p.first_name || "Membre",
                  photo: p.photos && p.photos.length > 0 ? p.photos[0] : 'https://placehold.co/400x600/1a1a2e/gold?text=😊',
                  date: new Date(v.created_at)
                } : null;
              }).filter(Boolean);
              setVisitors(formattedVisitors);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProfiles();
  }, []);

  const updateVisibility = async (newVis: "tous" | "demande" | "pause") => {
    const previous = visibility;
    setVisibility(newVis);

    const user = await getCurrentUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ visibility: newVis })
      .eq('id', user.id);

    if (error) {
      console.error('[accueil] visibilité:', error);
      setVisibility(previous); // on rétablit si l'écriture a échoué
      toast.error("Le réglage n'a pas pu être enregistré");
      return;
    }

    const messages = {
      tous: "Votre profil est visible par tous les membres",
      demande: "Votre profil n'est visible que des personnes que vous avez likées",
      pause: "Votre profil est masqué — vous n'apparaissez plus dans les découvertes",
    } as const;
    toast.success(messages[newVis]);
  };

  const sections: Section[] = [
    { title: "Recommandés pour vous", icon: Sparkles, data: profiles.slice(0, 8) },
    { title: "Membres Premium", icon: Crown, data: profiles.slice(0, 8) },
    { title: "Nouveaux membres", icon: UserPlus, data: profiles.slice(0, 8).reverse() },
  ];

  return (
    <div className="pt-4">
      {/* Rappel : sans ça, on oublie qu'on est masqué et on s'étonne du silence */}
      {visibility !== "tous" && !loading && (
        <div className="mx-4 mb-3 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5 flex items-center gap-2.5">
          {visibility === "pause" ? (
            <Pause className="w-4 h-4 text-gold shrink-0" />
          ) : (
            <HeartHandshake className="w-4 h-4 text-gold shrink-0" />
          )}
          <p className="text-[11px] flex-1 min-w-0">
            {visibility === "pause"
              ? "Votre profil est en pause : personne ne peut vous découvrir."
              : "Visibilité sur demande : seules les personnes que vous avez likées vous voient."}
          </p>
          <button
            onClick={() => updateVisibility("tous")}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-gold text-gold-foreground text-[10px] font-semibold"
          >
            Réactiver
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Banners Section */}
          <div className="px-4 space-y-4 mb-8">
            
            {/* Passe Premium Banner */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl bg-card border border-gold/30 p-4 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gold/20 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.5)]">
                    <Crown className="w-5 h-5 text-black" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-foreground font-bold text-base">Passe Premium</h3>
                    <span className="bg-gold text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">-40%</span>
                  </div>
                  <p className="text-muted-foreground text-xs">Demandes illimitées, profil mis en avant, badge Premium</p>
                </div>
              </div>
              <Link to="/abonnement" className="relative z-10 bg-gold hover:bg-gold/90 text-black text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1 transition-colors whitespace-nowrap">
                Découvrir <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>

            {/* Profile Completion Banner */}
            {currentUser && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-3xl bg-primary p-4 shadow-lg flex flex-col gap-4 cursor-pointer hover:bg-primary/95 transition-colors"
                onClick={() => window.location.href = '/profil'}
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={currentUser.photos?.[0] || 'https://placehold.co/400x600/1a1a2e/gold?text=😊'} 
                    alt="Mon profil" 
                    className="w-14 h-14 rounded-full object-cover border-2 border-white/20"
                  />
                  <div>
                    <h3 className="text-white font-bold text-lg">Salut, {currentUser.first_name || "Mister"} !</h3>
                    <p className="text-white/80 text-xs flex items-center gap-1.5 mt-0.5">
                      <span>{currentUser.city || "Ville inconnue"}, {currentUser.country || "Pays"}</span>
                      {currentUser.country && getCountryCode(currentUser.country) && (
                        <img 
                          src={`https://flagcdn.com/w40/${getCountryCode(currentUser.country)}.png`} 
                          alt={currentUser.country} 
                          className="w-3.5 h-3.5 rounded-full object-cover shadow-sm"
                        />
                      )}
                    </p>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between text-white text-xs font-medium mb-2">
                    <span>Profil complété</span>
                    <span className="text-lg font-bold">{completionScore}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${completionScore}%` }}
                    />
                  </div>
                  <p className="text-white/60 text-[10px] text-center mt-2 font-medium uppercase tracking-wider">
                    Cliquez pour compléter
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {profiles.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun profil trouvé.
            </div>
          ) : (
            sections.map((s, i) => {
              if (s.data.length === 0) return null;
              const Icon = s.icon;
              return (
                <section key={s.title} className="mb-7">
                  <div className="flex items-center justify-between px-4 mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-primary" />
                      <h3 className="font-serif text-lg font-semibold">{s.title}</h3>
                    </div>
                    <button className="text-xs font-medium text-primary hover:underline">Tout voir</button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none px-4 pb-2">
                    {s.data.map((p, k) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.04 * k + 0.05 * i }}
                        className="snap-start shrink-0 cursor-pointer"
                        onClick={() => setSelectedProfile(p)}
                      >
                        <ProfileCard profile={p} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              );
            })
          )}

          {/* === Additional Sections === */}
          <div className="px-4 space-y-5 pb-8">

            {/* Ils ont consulté ton profil */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-3xl bg-card border border-border/50 p-5 shadow-soft"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <h3 className="font-serif text-base font-semibold">Ils ont consulté ton profil</h3>
                </div>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {visitors.length} cette semaine
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Les membres qui ont récemment regardé ton profil.
              </p>
              <div className="space-y-3">
                {visitors.map((v) => (
                  <div key={v.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={v.photo} 
                        alt={v.firstName} 
                        className="w-9 h-9 rounded-full object-cover border border-border/50"
                      />
                      <span className="text-sm font-medium">{v.firstName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">1j</span>
                  </div>
                ))}
              </div>
              <Link
                to="/decouvrir"
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
              >
                Voir mes visiteurs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>

            {/* Conseil du jour */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-3xl bg-card border border-border/50 overflow-hidden shadow-soft"
            >
              <div className="px-5 pt-4 pb-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Pour toi</p>
                <p className="text-xs text-primary font-bold uppercase tracking-wider mt-1">Conseil du jour</p>
              </div>
              <div className="px-5 py-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-t border-b border-border/30">
                {dailyLoading || !dailyContent ? (
                  <div className="animate-pulse flex flex-col items-center space-y-3">
                    <div className="h-4 bg-primary/20 rounded w-full"></div>
                    <div className="h-4 bg-primary/20 rounded w-5/6"></div>
                    <div className="h-4 bg-primary/20 rounded w-4/6 mt-2"></div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground leading-relaxed italic text-center">
                      « {dailyContent.advice_text} »
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <span className="text-primary">✦</span>
                      <span className="text-primary">✦</span>
                      <span className="text-primary">✦</span>
                    </div>
                    <p className="text-center text-xs font-bold text-primary mt-2 uppercase tracking-wider">
                      {dailyContent.advice_ref}
                    </p>
                    <p className="text-center text-[10px] text-muted-foreground mt-1 italic">
                      {dailyContent.advice_source}
                    </p>
                  </>
                )}
              </div>
            </motion.div>

            {/* Guide */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-3xl bg-card border border-border/50 p-5 shadow-soft flex items-center gap-4 cursor-pointer hover:bg-card/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Compass className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold">Guide</h3>
                <p className="text-xs text-muted-foreground">Conseils pour réussir ta recherche</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </motion.div>

            {/* Visibilité du profil */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-3xl bg-card border border-border/50 p-5 shadow-soft"
            >
              <div className="mb-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Ton compte</p>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="text-sm font-bold">Visibilité du profil</h3>
                  <p className="text-xs text-muted-foreground">Choisis qui peut voir ton profil</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => updateVisibility("tous")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                    visibility === "tous"
                      ? "bg-primary text-white border-primary shadow-md"
                      : "bg-secondary/50 text-foreground border-border/50 hover:bg-secondary"
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-bold">Tous</span>
                  <span className={`text-[9px] ${visibility === "tous" ? "text-white/70" : "text-muted-foreground"}`}>
                    Visible par tous
                  </span>
                </button>
                <button
                  onClick={() => updateVisibility("demande")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                    visibility === "demande"
                      ? "bg-primary text-white border-primary shadow-md"
                      : "bg-secondary/50 text-foreground border-border/50 hover:bg-secondary"
                  }`}
                >
                  <HeartHandshake className="w-5 h-5" />
                  <span className="text-xs font-bold">Sur demande</span>
                  <span className={`text-[9px] ${visibility === "demande" ? "text-white/70" : "text-muted-foreground"}`}>
                    Ceux que tu as choisis
                  </span>
                </button>
                <button
                  onClick={() => updateVisibility("pause")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                    visibility === "pause"
                      ? "bg-primary text-white border-primary shadow-md"
                      : "bg-secondary/50 text-foreground border-border/50 hover:bg-secondary"
                  }`}
                >
                  <Pause className="w-5 h-5" />
                  <span className="text-xs font-bold">En pause</span>
                  <span className={`text-[9px] ${visibility === "pause" ? "text-white/70" : "text-muted-foreground"}`}>
                    Profil invisible
                  </span>
                </button>
              </div>
            </motion.div>

            {/* Premium CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Link
                to="/abonnement"
                className="w-full flex flex-col items-center gap-1 py-4 rounded-3xl bg-gold hover:bg-gold/90 text-black shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  <span className="text-base font-bold">Premium</span>
                </div>
                <span className="text-xs font-medium opacity-80">Débloque tout AgapeMeet</span>
              </Link>
            </motion.div>

          </div>
        </>
      )}

      {/* Profile detail modal */}
      <AnimatePresence>
        {selectedProfile && (
          <ProfileDetailModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Profile Detail Modal ─────────────────────────────────────────────────────
function ProfileDetailModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
    >
      <div className="min-h-full max-w-md mx-auto bg-background relative pb-24 shadow-2xl">
        {/* Hero photo */}
        <div className="relative aspect-[3/4]">
          <img src={profile.photo} alt={profile.firstName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-0 inset-x-0 p-6 pb-2">
            <h2 className="font-serif text-4xl font-bold flex items-center gap-2">
              {profile.firstName}, {profile.age}
              {profile.verified && <CheckCircle2 className="w-6 h-6 text-blue-500" />}
            </h2>
            <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm font-medium">
              <span>{profile.city}{profile.country ? `, ${profile.country}` : ""}</span>
              {profile.country && getCountryCode(profile.country) && (
                <img
                  src={`https://flagcdn.com/w40/${getCountryCode(profile.country)}.png`}
                  alt={profile.country}
                  className="w-4 h-4 rounded-full object-cover shadow-sm"
                />
              )}
              <span>•</span>
              <span className="text-primary">{profile.compatibility}% Compatible</span>
            </div>
          </div>
        </div>

        {/* Other photos */}
        {profile.photos.length > 1 && (
          <div className="px-4 pt-4">
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {profile.photos.slice(1).map((photo, i) => (
                <img key={i} src={photo} alt="" className="w-24 h-32 object-cover rounded-xl shrink-0 shadow-sm" />
              ))}
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Bio */}
          {profile.bio && profile.bio !== "Pas de bio." && (
            <section>
              <h3 className="font-serif text-lg font-semibold mb-2">À propos</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
            </section>
          )}

          {/* Faith */}
          <section>
            <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
              <Church className="w-5 h-5 text-primary" /> Foi &amp; Vision
            </h3>
            <div className="space-y-3 bg-secondary/30 p-4 rounded-2xl border border-border/50">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Dénomination</span>
                <p className="font-medium">{profile.denomination || "Non précisé"}</p>
              </div>
              {profile.marriageVision && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Vision du mariage</span>
                  <p className="font-medium text-sm leading-relaxed">{profile.marriageVision}</p>
                </div>
              )}
              {profile.church && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Église</span>
                  <p className="font-medium text-sm">{profile.church}</p>
                </div>
              )}
            </div>
          </section>

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <section>
              <h3 className="font-serif text-lg font-semibold mb-3">Intérêts</h3>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">{tag}</span>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <Link
            to="/decouvrir"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold shadow-elegant hover:opacity-90 transition-opacity"
          >
            <BookOpen className="w-4 h-4" />
            Découvrir ce profil dans l'appli
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
