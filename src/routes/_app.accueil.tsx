import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Crown, UserPlus, ArrowRight, Eye, BookOpen, Compass, Pause, Users, HeartHandshake } from "lucide-react";
import { ProfileCard } from "@/components/app/ProfileCard";
import { supabase } from "@/lib/supabase";
import { type Profile } from "@/lib/mock-data";
import { getCountryCode } from "@/lib/utils";

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

const dailyVerses = [
  { text: "On épouse une personne pour quatre choses : sa richesse, son lignage, sa beauté et sa foi. Choisis celle qui a la foi, et tu seras comblé.", source: "Adapté de la sagesse biblique", ref: "CHOISIS D'ABORD LA FOI" },
  { text: "Celui qui trouve une femme trouve le bonheur ; c'est une grâce qu'il obtient de l'Éternel.", source: "Proverbes 18:22", ref: "LE MARIAGE EST UNE GRÂCE" },
  { text: "L'amour est patient, l'amour est plein de bonté ; il n'est point envieux, ne se vante point, ne s'enfle point d'orgueil.", source: "1 Corinthiens 13:4", ref: "L'AMOUR VÉRITABLE" },
  { text: "Il n'est pas bon que l'homme soit seul ; je lui ferai une aide semblable à lui.", source: "Genèse 2:18", ref: "UNE AIDE SEMBLABLE" },
  { text: "Que tout ce que vous faites soit fait avec amour.", source: "1 Corinthiens 16:14", ref: "TOUT AVEC AMOUR" },
];

function HomePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [completionScore, setCompletionScore] = useState(0);
  const [visibility, setVisibility] = useState<"tous" | "demande" | "pause">("tous");
  const [visitors, setVisitors] = useState<any[]>([]);

  const todayVerse = dailyVerses[new Date().getDay() % dailyVerses.length];

  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: currentUserData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
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
        
        if (currentUserData && currentUserData.seeking_gender && currentUserData.seeking_gender !== "all") {
          query = query.eq('gender', currentUserData.seeking_gender);
        }

        const { data } = await query;
        
        if (data) {
          const formatted: Profile[] = data.map((p: any) => ({
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
          
          // Fetch real visitors
          const { data: visits } = await supabase.from('profile_visits').select('visitor_id, created_at').eq('visited_id', user.id).order('created_at', { ascending: false }).limit(5);
          if (visits && visits.length > 0) {
            const visitorIds = visits.map((v: any) => v.visitor_id);
            const { data: visitorProfiles } = await supabase.from('profiles').select('*').in('id', visitorIds);
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
    setVisibility(newVis);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ visibility: newVis }).eq('id', user.id);
    }
  };

  const sections: Section[] = [
    { title: "Recommandés pour vous", icon: Sparkles, data: profiles.slice(0, 8) },
    { title: "Membres Premium", icon: Crown, data: profiles.slice(0, 8) },
    { title: "Nouveaux membres", icon: UserPlus, data: profiles.slice(0, 8).reverse() },
  ];

  return (
    <div className="pt-4">
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
                        className="snap-start shrink-0"
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
                <p className="text-sm text-foreground leading-relaxed italic text-center">
                  « {todayVerse.text} »
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <span className="text-primary">✦</span>
                  <span className="text-primary">✦</span>
                  <span className="text-primary">✦</span>
                </div>
                <p className="text-center text-xs font-bold text-primary mt-2 uppercase tracking-wider">
                  {todayVerse.ref}
                </p>
                <p className="text-center text-[10px] text-muted-foreground mt-1 italic">
                  {todayVerse.source}
                </p>
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
    </div>
  );
}
