import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/auth";
import {
  featuresFor,
  getPlan,
  OFFERS,
  PLANS,
  type Offer,
  type PlanFeatures,
  type PlanId,
  type PlanLevel,
} from "@/lib/plans";
import { useSettings, applyQuotaSettings } from "@/lib/appSettings";

export { PLANS, OFFERS, getPlan, formatPrice, offersFor, getOffer, pricePerDay, savingsVsMonthly } from "@/lib/plans";
export type { Plan, PlanId, PlanFeatures, Offer, DurationId } from "@/lib/plans";

/**
 * L'abonnement fait désormais autorité côté serveur.
 *
 * Auparavant l'état vivait dans le localStorage : trois lignes dans la console
 * du navigateur suffisaient à s'octroyer VIP. Seul le webhook Chariow, qui
 * passe par la service key, peut créditer la table `subscriptions` — la RLS
 * n'accorde à l'utilisateur qu'un droit de lecture.
 *
 * Les compteurs d'usage quotidien (Super Likes, Boosts) restent en local :
 * ce sont des garde-fous de confort, pas des droits d'accès.
 */

type Usage = { day: string; superLikes: number; month: string; boosts: number };

const USAGE_KEY = "agapemeet.usage";
const todayKey = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);

const initialUsage: Usage = { day: todayKey(), superLikes: 0, month: monthKey(), boosts: 0 };

type SubscriptionContextValue = {
  planId: PlanId;
  plan: ReturnType<typeof getPlan>;
  expiresAt: string | null;
  daysLeft: number | null;
  isPaid: boolean;
  /** Inscrit avant la mise en place du paiement — accès VIP à vie. */
  isFounder: boolean;
  /** 0 gratuit · 1 15j · 2 1 mois · 3 3 mois · 4 VIP */
  level: PlanLevel;
  loading: boolean;
  features: PlanFeatures;
  superLikesLeft: number; // -1 = illimité
  boostsLeft: number; // -1 = illimité
  consumeSuperLike: () => boolean;
  consumeBoost: () => boolean;
  /** Ouvre le paiement Chariow pour l'offre choisie. */
  startCheckout: (offer: Offer, phone: string, countryCode: string) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => Promise<void>;
  /** Nombre de paiements encore en attente de confirmation. */
  pendingPayments: number;
  /** Interroge Chariow sur les paiements en attente et crédite ce qui est dû. */
  reconcile: () => Promise<{ recovered: number; pending: number }>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [planId, setPlanId] = useState<PlanId>("gratuit");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<Usage>(initialUsage);
  const [pendingPayments, setPendingPayments] = useState(0);
  /** Membre inscrit avant la mise en place du paiement : accès VIP à vie. */
  const [isFounder, setIsFounder] = useState(false);
  const [level, setLevel] = useState<PlanLevel>(0);
  // Réglages d'administration : lus une fois, mis en cache par le module.
  const settings = useSettings();

  // ── Compteurs d'usage (locaux) ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(USAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Usage;
      setUsage({
        day: todayKey(),
        month: monthKey(),
        superLikes: parsed.day === todayKey() ? parsed.superLikes : 0,
        boosts: parsed.month === monthKey() ? parsed.boosts : 0,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const persistUsage = useCallback((next: Usage) => {
    setUsage(next);
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  // ── Abonnement (serveur) ──
  const load = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      setPlanId("gratuit");
      setExpiresAt(null);
      setIsFounder(false);
      setLevel(0);
      setLoading(false);
      return;
    }

    // Une seule requête, et le serveur tranche : abonnement payé, statut
    // fondateur et expiration sont décidés en base, jamais côté client.
    const { data, error } = await supabase.rpc("my_entitlements");

    if (error) {
      console.error("[subscription] chargement:", error);
      setLoading(false);
      return;
    }

    setPlanId((data?.plan as PlanId) ?? "gratuit");
    setExpiresAt(data?.expires_at ?? null);
    setIsFounder(Boolean(data?.is_founder));
    setLevel((data?.level ?? 0) as PlanLevel);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Interroge Chariow sur les paiements en attente et crédite ce qui est dû. */
  const reconcile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { recovered: 0, pending: 0 };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chariow-reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (!res.ok) return { recovered: 0, pending: 0 };

      const json = await res.json();
      setPendingPayments(json.pending ?? 0);
      if (json.recovered > 0) await load();
      return { recovered: json.recovered ?? 0, pending: json.pending ?? 0 };
    } catch {
      return { recovered: 0, pending: 0 };
    }
  }, [load]);

  // Rattrapage au démarrage : un paiement encaissé dont la notification
  // n'est jamais arrivée serait sinon perdu sans que personne ne le sache.
  useEffect(() => {
    const t = setTimeout(() => { reconcile(); }, 1500);
    return () => clearTimeout(t);
  }, [reconcile]);

  // ── Temps réel : le webhook crédite, l'écran se met à jour tout seul ──
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const userId = await getCurrentUserId();
      if (!userId) return;

      channel = supabase
        .channel(`subscription:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
          (payload: any) => {
            const row = payload.new;
            if (!row) return;
            // Un fondateur reste VIP quoi qu'il arrive côté abonnements :
            // sans cette garde, la réception d'une ligne expirée le
            // rétrograderait en gratuit.
            if (isFounder) return;
            const expired = row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : true;
            setPlanId(expired ? "gratuit" : (row.plan_id as PlanId));
            setExpiresAt(row.expires_at ?? null);
          },
        )
        .subscribe();
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [isFounder]);

  // Repasse au gratuit sans rechargement quand la période expire pendant la session
  useEffect(() => {
    if (!expiresAt) return;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0 || ms > 2 ** 31 - 1) return;
    const t = setTimeout(() => setPlanId("gratuit"), ms);
    return () => clearTimeout(t);
  }, [expiresAt]);

  const value = useMemo<SubscriptionContextValue>(() => {
    const plan = getPlan(planId);
    // Les quotas dépendent du palier acheté, pas seulement de la formule.
    // `applyQuotaSettings` recale ensuite ces valeurs sur les réglages
    // d'administration, afin que l'interface annonce exactement ce que la
    // base autorise — sans quoi les deux divergeraient dès le premier
    // ajustement fait dans /admin/parametres.
    const f = applyQuotaSettings(featuresFor(planId, level), settings, level);

    const superLikesLeft =
      f.superLikesPerDay === -1 ? -1 : Math.max(0, f.superLikesPerDay - usage.superLikes);
    const boostsLeft =
      f.boostsPerMonth === -1 ? -1 : Math.max(0, f.boostsPerMonth - usage.boosts);

    const daysLeft = expiresAt
      ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
      : null;

    return {
      planId,
      plan,
      expiresAt,
      daysLeft,
      isPaid: planId !== "gratuit",
      isFounder,
      level,
      loading,
      features: f,
      superLikesLeft,
      boostsLeft,

      consumeSuperLike: () => {
        if (superLikesLeft === 0) return false;
        if (superLikesLeft === -1) return true;
        persistUsage({ ...usage, day: todayKey(), superLikes: usage.superLikes + 1 });
        return true;
      },

      consumeBoost: () => {
        if (boostsLeft === 0) return false;
        if (boostsLeft === -1) return true;
        persistUsage({ ...usage, month: monthKey(), boosts: usage.boosts + 1 });
        return true;
      },

      startCheckout: async (offer, phone, countryCode) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return { ok: false, error: "Vous devez être connecté" };

          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chariow-checkout`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ offerId: offer.id, phone, countryCode }),
            },
          );

          const json = await res.json();
          if (!res.ok) return { ok: false, error: json?.error ?? "Le paiement n'a pas pu être lancé" };

          // La commande est créée côté serveur : l'intention d'achat est
          // réelle. InitiateCheckout, pas Purchase — l'argent n'a pas encore
          // changé de main, et beaucoup de tunnels sont abandonnés ici.
          import("@/lib/meta").then(m =>
            m.suivreMeta("InitiateCheckout", {
              valeurXof: offer.priceXOF,
              // Le numero vient d etre saisi pour le Mobile Money : il
              // ameliore nettement la correspondance chez Meta, et part
              // hache — jamais en clair.
              telephone: phone,
            }),
          );

          // Chariow affiche ses propres moyens de paiement selon l'indicatif
          if (json.checkoutUrl) {
            window.location.href = json.checkoutUrl;
            return { ok: true };
          }
          if (json.step === "completed") {
            await load();
            return { ok: true };
          }
          return { ok: false, error: "Réponse inattendue du serveur de paiement" };
        } catch (e) {
          console.error("[subscription] checkout:", e);
          return { ok: false, error: "Erreur réseau" };
        }
      },

      refresh: load,
      pendingPayments,
      reconcile,
    };
  }, [planId, expiresAt, loading, usage, persistUsage, load, pendingPayments, reconcile, isFounder, level, settings]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription doit être utilisé dans SubscriptionProvider");
  return ctx;
}
