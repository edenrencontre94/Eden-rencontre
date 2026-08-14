import { Crown, Gem } from "lucide-react";
import { publicPlanOf, PLAN_BADGE, type BadgeSource } from "@/lib/badges";

/**
 * Badge d'offre, en deux tailles.
 *
 * VIP porte un autre symbole que Premium, pas seulement une autre couleur :
 * sur une carte de profil vue au pouce, deux couronnes de teintes voisines
 * ne se distinguent pas — et la hiérarchie qu'on facture disparaît.
 */
export function PlanBadge({ profile, compact }: { profile?: BadgeSource | null; compact?: boolean }) {
  const plan = publicPlanOf(profile);
  if (!plan) return null;

  const { label, cls } = PLAN_BADGE[plan];
  const Icon = Crown;

  if (compact) {
    // Icône seule : sur les vignettes étroites, le libellé pousserait le
    // reste hors de la carte.
    return (
      <span
        title={label}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border ${cls}`}
      >
        <Icon className="w-3 h-3" />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
