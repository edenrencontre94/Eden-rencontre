/**
 * Badge d'offre affiché sur les profils.
 *
 * `public_plan` dit QUOI, `premium_until` dit JUSQU'À QUAND. Les deux sont
 * nécessaires : sans la date, un badge resterait affiché après expiration ;
 * sans le palier, Premium et VIP porteraient la même couronne, ce qui
 * viderait le VIP de la distinction qu'on facture trois fois le prix.
 *
 * Aucun badge pour la formule Gratuite — un badge « Gratuit » ne
 * distinguerait rien et stigmatiserait ceux qui ne paient pas.
 */

export type PublicPlan = "premium" | null;

export type BadgeSource = {
  public_plan?: string | null;
  premium_until?: string | null;
  is_founder?: boolean | null;
};

export function publicPlanOf(p?: BadgeSource | null): PublicPlan {
  if (!p) return null;

  // Les membres fondateurs ont l'accès complet à vie, sans échéance.
  if (p.is_founder) return "premium";

  const until = p.premium_until ? new Date(p.premium_until).getTime() : 0;
  if (until <= Date.now()) return null;

  return p.public_plan === "premium" ? "premium" : null;
}

export const PLAN_BADGE: Record<"premium", { label: string; cls: string }> = {
  premium: {
    label: "Premium",
    cls: "bg-primary/15 text-primary border-primary/25",
  },
};
