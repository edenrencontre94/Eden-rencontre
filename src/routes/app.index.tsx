import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Crown, UserPlus, ArrowRight } from "lucide-react";
import { ProfileCard } from "@/components/app/ProfileCard";
import { supabase } from "@/lib/supabase";
import { type Profile } from "@/lib/mock-data";

export const Route = createFileRoute("/app/")({
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

const getCountryCode = (countryName: string) => {
  const map: Record<string, string> = {
    "côte d'ivoire": "ci",
    "sénégal": "sn",
    "cameroun": "cm",
    "bénin": "bj",
    "togo": "tg",
    "mali": "ml",
    "burkina faso": "bf",
    "gabon": "ga",
    "congo": "cg",
    "rdc": "cd",
    "guinée": "gn",
    "madagascar": "mg",
    "france": "fr",
    "belgique": "be",
    "suisse": "ch",
    "canada": "ca",
  };
  return map[countryName?.toLowerCase()] || null;
};

function HomePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [completionScore, setCompletionScore] = useState(0);

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
          const totalFields = fields.length + 2; // +2 for photos
          
          setCompletionScore(Math.round(((filled + photoBonus) / totalFields) * 100));
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
            verified: true, // TODO
            premium: false, // TODO
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
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProfiles();
  }, []);

  const sections: Section[] = [
    { title: "Recommandés pour vous", icon: Sparkles, data: profiles.slice(0, 8) },
    { title: "Nouveaux membres", icon: UserPlus, data: profiles.slice(0, 8).reverse() },
    { title: "Membres Alliance", icon: Crown, data: profiles.slice(0, 8) },
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
            
            {/* Passe Alliance Banner */}
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
                    <h3 className="text-foreground font-bold text-base">Passe Alliance</h3>
                    <span className="bg-gold text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">-40%</span>
                  </div>
                  <p className="text-muted-foreground text-xs">Demandes illimitées, profil mis en avant, badge Alliance</p>
                </div>
              </div>
              <Link to="/app/abonnement" className="relative z-10 bg-gold hover:bg-gold/90 text-black text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1 transition-colors whitespace-nowrap">
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
                onClick={() => window.location.href = '/app/profil'}
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
                      {currentUser.country && getCountryCode(currentUser.country) && (
                        <img 
                          src={`https://flagcdn.com/w40/${getCountryCode(currentUser.country)}.png`} 
                          alt={currentUser.country} 
                          className="w-3.5 h-3.5 rounded-full object-cover shadow-sm"
                        />
                      )}
                      <span>{currentUser.city || "Ville inconnue"}, {currentUser.country || "Pays"}</span>
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
            /* Sections */
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
        </>
      )}
    </div>
  );
}