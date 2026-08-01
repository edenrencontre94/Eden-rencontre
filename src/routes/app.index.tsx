import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Crown, UserPlus } from "lucide-react";
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

function HomePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: currentUserData } = await supabase.from('profiles').select('seeking_gender').eq('id', user.id).single();

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

  const heroProfile = profiles[0];

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
      ) : profiles.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aucun profil trouvé.
        </div>
      ) : (
        <>
          {/* Hero suggestion */}
          {heroProfile && (
            <section className="px-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-3xl overflow-hidden shadow-elegant"
              >
                <div className="aspect-[16/10] relative">
                  <img
                    src={heroProfile.photo}
                    alt={heroProfile.firstName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur text-[11px] font-semibold">
                      <Sparkles className="w-3.5 h-3.5" /> Suggestion du jour
                    </span>
                    <h2 className="font-serif text-3xl mt-2">
                      {heroProfile.firstName}, {heroProfile.age}
                    </h2>
                    <p className="text-sm opacity-90">
                      {heroProfile.city} · {heroProfile.denomination} · {heroProfile.compatibility}% de compatibilité
                    </p>
                  </div>
                </div>
              </motion.div>
            </section>
          )}

          {/* Sections */}
          {sections.map((s, i) => {
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
          })}
        </>
      )}
    </div>
  );
}