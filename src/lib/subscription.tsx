import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PlanId = "gratuit" | "premium" | "premium";
export type BillingCycle = "mensuel" | "annuel";

export type PlanFeatures = {
  visitors: boolean;
  superLikesPerDay: number; // -1 = illimité
  boostsPerMonth: number; // -1 = illimité
  unlimitedLikes: boolean;
  advancedFilters: boolean;
  readReceipts: boolean;
  incognito: boolean;
  priorityVerification: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthly: number; // FCFA
  priceYearly: number; // FCFA
  highlight?: boolean;
  perks: string[];
  features: PlanFeatures;
};

export const PLANS: Plan[] = [
  {
    id: "gratuit",
    name: "Gratuit",
    tagline: "Pour découvrir la communauté",
    priceMonthly: 0,
    priceYearly: 0,
    perks: [
      "Profil complet et vérification de base",
      "20 likes par jour",
      "1 Super Like par jour",
      "Accès à la communauté spirituelle",
    ],
    features: {
      visitors: false,
      superLikesPerDay: 1,
      boostsPerMonth: 0,
      unlimitedLikes: false,
      advancedFilters: false,
      readReceipts: false,
      incognito: false,
      priorityVerification: false,
    },
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Pour ceux qui visent le mariage",
    priceMonthly: 6500,
    priceYearly: 54000,
    highlight: true,
    perks: [
      "Voir qui a visité votre profil",
      "Likes illimités",
      "5 Super Likes par jour",
      "1 Boost offert chaque mois",
      "Filtres avancés (confession, pratique, distance)",
      "Accusés de lecture en messagerie",
    ],
    features: {
      visitors: true,
      superLikesPerDay: 5,
      boostsPerMonth: 1,
      unlimitedLikes: true,
      advancedFilters: true,
      readReceipts: true,
      incognito: false,
      priorityVerification: false,
    },
  },
  {
    id: "premium",
    name: "VIP",
    tagline: "Il représente l'amour inconditionnel de Dieu.",
    priceMonthly: 12000,
    priceYearly: 98000,
    perks: [
      "Tout le plan Premium",
      "Super Likes et Boosts illimités",
      "Mode incognito",
      "Vérification identité + foi prioritaire",
      "Mise en avant auprès des profils compatibles",
      "Accompagnement par un conseiller",
    ],
    features: {
      visitors: true,
      superLikesPerDay: -1,
      boostsPerMonth: -1,
      unlimitedLikes: true,
      advancedFilters: true,
      readReceipts: true,
      incognito: true,
      priorityVerification: true,
    },
  },
];

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

type Usage = {
  day: string;
  superLikes: number;
  month: string;
  boosts: number;
};

type SubscriptionState = {
  planId: PlanId;
  cycle: BillingCycle;
  since: string | null;
  renewsOn: string | null;
  usage: Usage;
};

const STORAGE_KEY = "agapemeet.subscription";

const todayKey = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);

const initialState: SubscriptionState = {
  planId: "gratuit",
  cycle: "mensuel",
  since: null,
  renewsOn: null,
  usage: { day: todayKey(), superLikes: 0, month: monthKey(), boosts: 0 },
};

type SubscriptionContextValue = {
  planId: PlanId;
  plan: Plan;
  cycle: BillingCycle;
  since: string | null;
  renewsOn: string | null;
  isPaid: boolean;
  features: PlanFeatures;
  superLikesLeft: number; // -1 = illimité
  boostsLeft: number; // -1 = illimité
  consumeSuperLike: () => boolean;
  consumeBoost: () => boolean;
  subscribe: (planId: PlanId, cycle: BillingCycle) => void;
  cancel: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>(initialState);

  // hydrate côté client uniquement
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SubscriptionState;
      setState({
        ...initialState,
        ...parsed,
        usage: {
          day: todayKey(),
          month: monthKey(),
          superLikes: parsed.usage?.day === todayKey() ? parsed.usage.superLikes : 0,
          boosts: parsed.usage?.month === monthKey() ? parsed.usage.boosts : 0,
        },
      });
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: SubscriptionState) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<SubscriptionContextValue>(() => {
    const plan = getPlan(state.planId);
    const f = plan.features;
    const superLikesLeft =
      f.superLikesPerDay === -1 ? -1 : Math.max(0, f.superLikesPerDay - state.usage.superLikes);
    const boostsLeft =
      f.boostsPerMonth === -1 ? -1 : Math.max(0, f.boostsPerMonth - state.usage.boosts);

    return {
      planId: state.planId,
      plan,
      cycle: state.cycle,
      since: state.since,
      renewsOn: state.renewsOn,
      isPaid: state.planId !== "gratuit",
      features: f,
      superLikesLeft,
      boostsLeft,
      consumeSuperLike: () => {
        if (superLikesLeft === 0) return false;
        if (superLikesLeft === -1) return true;
        persist({
          ...state,
          usage: { ...state.usage, day: todayKey(), superLikes: state.usage.superLikes + 1 },
        });
        return true;
      },
      consumeBoost: () => {
        if (boostsLeft === 0) return false;
        if (boostsLeft === -1) return true;
        persist({
          ...state,
          usage: { ...state.usage, month: monthKey(), boosts: state.usage.boosts + 1 },
        });
        return true;
      },
      subscribe: (planId, cycle) => {
        const renew = new Date();
        if (cycle === "annuel") renew.setFullYear(renew.getFullYear() + 1);
        else renew.setMonth(renew.getMonth() + 1);
        persist({
          planId,
          cycle,
          since: new Date().toISOString(),
          renewsOn: renew.toISOString(),
          usage: { day: todayKey(), month: monthKey(), superLikes: 0, boosts: 0 },
        });
      },
      cancel: () => persist({ ...initialState, usage: state.usage }),
    };
  }, [state, persist]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription doit être utilisé dans SubscriptionProvider");
  return ctx;
}