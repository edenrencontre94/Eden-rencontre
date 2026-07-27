import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Sparkles, Flame, ShieldCheck, Crown, Activity, UserPlus } from "lucide-react";
import { ProfileCard } from "@/components/app/ProfileCard";
import {
  recommendedProfiles,
  newMembers,
  mostCompatible,
  verifiedProfiles,
  premiumProfiles,
  recentlyActive,
  type Profile,
} from "@/lib/mock-data";

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
  const sections: Section[] = [
    { title: "Recommandés pour vous", icon: Sparkles, data: recommendedProfiles },
    { title: "Les plus compatibles", icon: Flame, data: mostCompatible },
    { title: "Nouveaux membres", icon: UserPlus, data: newMembers },
    { title: "Profils vérifiés", icon: ShieldCheck, data: verifiedProfiles },
    { title: "Membres Premium", icon: Crown, data: premiumProfiles },
    { title: "Récemment actifs", icon: Activity, data: recentlyActive },
  ];

  return (
    <div className="pt-4">
      {/* Hero suggestion */}
      <section className="px-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden shadow-elegant"
        >
          <div className="aspect-[16/10] relative">
            <img
              src={recommendedProfiles[0].photo}
              alt={recommendedProfiles[0].firstName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur text-[11px] font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Suggestion du jour
              </span>
              <h2 className="font-serif text-3xl mt-2">
                {recommendedProfiles[0].firstName}, {recommendedProfiles[0].age}
              </h2>
              <p className="text-sm opacity-90">
                {recommendedProfiles[0].city} · {recommendedProfiles[0].denomination} · {recommendedProfiles[0].compatibility}% de compatibilité
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Sections */}
      {sections.map((s, i) => {
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
    </div>
  );
}