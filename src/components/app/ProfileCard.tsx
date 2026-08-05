import { CheckCircle2, Crown, MapPin, Circle, Rocket } from "lucide-react";
import type { Profile } from "@/lib/mock-data";
import { getCountryCode } from "@/lib/utils";
import { isBoosted } from "@/lib/matching";

export function ProfileCard({ profile, size = "md" }: { profile: Profile; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`group relative rounded-2xl overflow-hidden shadow-soft hover:shadow-elegant transition-all bg-card ${size === "sm" ? "w-40" : size === "lg" ? "w-full" : "w-56"}`}>
      <div className={`relative ${size === "sm" ? "aspect-[3/4]" : "aspect-[4/5]"} overflow-hidden`}>
        <img
          src={profile.photo}
          alt={profile.firstName}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            {isBoosted(profile.boostedUntil) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow-elegant">
                <Rocket className="w-3 h-3" />
                En Avant
              </span>
            )}
            {profile.verified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/90 backdrop-blur text-[10px] font-semibold text-primary shadow-soft">
                <CheckCircle2 className="w-3 h-3" />
                Vérifié
              </span>
            )}
            {profile.premium && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold text-gold-foreground text-[10px] font-semibold shadow-soft">
                <Crown className="w-3 h-3" />
                Premium
              </span>
            )}
          </div>
          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-elegant">
            {profile.compatibility}%
          </span>
        </div>

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-lg font-semibold leading-tight">
              {profile.firstName}
            </span>
            <span className="text-sm opacity-90">{profile.age}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] opacity-90 mt-0.5">
            <MapPin className="w-3 h-3" />
            <span>{profile.city}, {profile.country}</span>
            {profile.country && getCountryCode(profile.country) && (
              <img 
                src={`https://flagcdn.com/w40/${getCountryCode(profile.country)}.png`} 
                alt={profile.country} 
                className="w-3 h-3 rounded-full object-cover ml-0.5 shadow-sm"
              />
            )}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] opacity-80">{profile.denomination}</span>
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