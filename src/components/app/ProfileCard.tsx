import { CheckCircle2, MapPin, Circle, Rocket, Church } from "lucide-react";
import { PlanBadge } from "@/components/app/PlanBadge";
import { Avatar } from "@/components/app/Avatar";
import type { Profile } from "@/lib/mock-data";
import { displayName } from "@/lib/utils";
import { Drapeau } from "@/components/app/Drapeau";


export function ProfileCard({ profile, size = "md" }: { profile: Profile; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`group relative rounded-2xl overflow-hidden shadow-soft hover:shadow-elegant transition-all bg-card ${size === "sm" ? "w-40" : size === "lg" ? "w-full" : "w-56"}`}>
      <div className={`relative ${size === "sm" ? "aspect-[3/4]" : "aspect-[4/5]"} overflow-hidden`}>
        <Avatar
          src={profile.photo}
          name={profile.firstName}
          rounded=""
          className="w-full h-full text-5xl group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">

            {profile.verified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/90 backdrop-blur text-[10px] font-semibold text-primary shadow-soft">
                <CheckCircle2 className="w-3 h-3" />
                Vérifié
              </span>
            )}
            {/* Badge d'offre réel. L'ancien test portait sur `profile.premium`,
                câblé à `false` dans les deux écrans qui construisent les
                profils : aucune couronne ne s'affichait jamais. */}
            <PlanBadge
              profile={{
                public_plan: profile.plan,
                premium_until: profile.planUntil,
                is_founder: profile.isFounder,
              }}
            />
          </div>
          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-elegant">
            {profile.compatibility}%
          </span>
        </div>

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          {/* `min-w-0` sur le conteneur du nom, sinon `truncate` reste sans
              effet dans un flex : l'élément refuserait de rétrécir et l'âge
              serait poussé hors de la carte. */}
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-lg font-semibold leading-tight truncate min-w-0">
              {displayName(profile.firstName, profile.lastName)}
            </span>
            <span className="text-sm opacity-90 shrink-0">{profile.age}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] opacity-90 mt-0.5">
            <MapPin className="w-3 h-3" />
            <span>{profile.city}, {profile.country}</span>
            <Drapeau pays={profile.country} className="w-3.5 h-3.5 ml-0.5" />
          </div>
          <div className="flex items-center justify-between mt-1 gap-2">
            {/* Même repère que sur la carte de découverte : la confession
                est l'information qui distingue cette application, elle ne
                doit pas passer pour une ligne de texte parmi d'autres. */}
            <span className="flex items-center gap-1 text-[10px] opacity-80 min-w-0">
              <Church className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{profile.denomination}</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] opacity-80">
              <Circle className={`w-2 h-2 ${profile.lastActive === "En ligne" ? "fill-green-400 text-green-400" : "fill-white/50 text-white/50"}`} />
              {profile.lastActive}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}