import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  Crown,
  Eye,
  Star,
  Zap,
  Sparkles,
  ShieldCheck,
  X,
  Loader2,
  CreditCard,
  Smartphone,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { CheckoutSheet } from "@/components/app/CheckoutSheet";
import {
  PLANS,
  formatPrice,
  offersFor,
  savingsVsMonthly,
  useSubscription,
  type Offer,
  type Plan,
} from "@/lib/subscription";

export const Route = createFileRoute("/_app/abonnement")({
  head: () => ({
    meta: [
      { title: "Abonnement — AgapeMeet" },
      {
        name: "description",
        content:
          "Choisissez votre formule AgapeMeet : visiteurs, Super Likes illimités, Boosts et filtres avancés.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const {
    plan, planId, expiresAt, daysLeft, isPaid, loading,
    superLikesLeft, boostsLeft, refresh, pendingPayments, reconcile,
  } = useSubscription();
  const [checkoutOffer, setCheckoutOffer] = useState<Offer | null>(null);
  const [checking, setChecking] = useState(false);

  const verifyNow = async () => {
    setChecking(true);
    const { recovered, pending } = await reconcile();
    setChecking(false);

    if (recovered > 0) toast.success("Paiement confirmé — votre formule est active 🎉");
    else if (pending > 0) toast.info("Paiement encore en attente chez l'opérateur.");
    else toast.info("Aucun paiement en attente.");
  };

  // Retour depuis la page de paiement Chariow : on resynchronise
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paiement") !== "retour") return;

    toast.info("Paiement en cours de validation…", {
      description: "Votre formule s'activera automatiquement dès confirmation.",
    });
    refresh();
    window.history.replaceState({}, "", window.location.pathname);

    // La notification arrive en général en quelques secondes ; si elle se
    // perd, ces vérifications rattrapent le paiement sans intervention.
    const timers = [5000, 15000, 40000].map(ms => setTimeout(() => reconcile(), ms));
    return () => timers.forEach(clearTimeout);
  }, [refresh, reconcile]);

  return (
    <div className="px-4 pt-4 pb-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/15 text-gold text-[11px] font-semibold">
          <Crown className="w-3.5 h-3.5" /> Abonnement
        </div>
        <h1 className="font-serif text-2xl font-semibold mt-2">Passez au niveau supérieur</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Voyez vos visiteurs, envoyez des Super Likes illimités et boostez votre profil.
        </p>
      </div>

      {/* Paiement encaissé mais pas encore confirmé */}
      {pendingPayments > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-3.5 flex items-start gap-3"
        >
          <Loader2 className="w-4 h-4 text-gold animate-spin shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Paiement en attente de confirmation</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Si vous avez validé le paiement sur votre téléphone, votre formule s'activera
              automatiquement. Vous pouvez aussi vérifier maintenant.
            </p>
            <button
              onClick={verifyNow}
              disabled={checking}
              className="mt-2 px-3 py-1.5 rounded-lg bg-gold text-gold-foreground text-[11px] font-semibold disabled:opacity-60"
            >
              {checking ? "Vérification…" : "Vérifier mon paiement"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Statut actuel */}
      <div className="mt-5 rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Formule actuelle
            </div>
            <div className="font-serif text-xl font-semibold flex items-center gap-1.5">
              {loading ? "…" : plan.name}
              {isPaid && <BadgeCheck className="w-4 h-4 text-gold" />}
            </div>
            {isPaid && expiresAt && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Expire le {new Date(expiresAt).toLocaleDateString("fr-FR")}
                {daysLeft !== null && ` · ${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`}
              </div>
            )}
          </div>
          {isPaid && daysLeft !== null && daysLeft <= 5 && (
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold">
              Bientôt expiré
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <StatTile icon={Eye} label="Visiteurs" value={plan.features.visitors ? "Oui" : "Non"} />
          <StatTile
            icon={Star}
            label="Super Likes"
            value={superLikesLeft === -1 ? "∞" : String(superLikesLeft)}
          />
          <StatTile
            icon={Zap}
            label="Boosts"
            value={boostsLeft === -1 ? "∞" : String(boostsLeft)}
          />
        </div>
      </div>

      {/* Formules */}
      <div className="mt-6 space-y-4">
        {PLANS.map((p, i) => (
          <PlanCard
            key={p.id}
            plan={p}
            current={p.id === planId}
            delay={i * 0.05}
            onChoose={setCheckoutOffer}
          />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-5 leading-relaxed">
        Paiement unique, sans engagement ni prélèvement automatique.
        <br />
        Un nouvel achat pendant une période active <strong>prolonge</strong> votre abonnement.
      </p>

      <AnimatePresence>
        {checkoutOffer && (
          <CheckoutSheet
            offerId={checkoutOffer.id}
            title={`${checkoutOffer.planId === "vip" ? "VIP" : "Premium"} · ${checkoutOffer.label}`}
            subtitle={`Abonnement de ${checkoutOffer.label}`}
            priceXOF={checkoutOffer.priceXOF}
            onClose={() => setCheckoutOffer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-2.5 text-center">
      <Icon className="w-4 h-4 mx-auto text-primary" />
      <div className="text-sm font-semibold mt-1">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  delay,
  onChoose,
}: {
  plan: Plan;
  current: boolean;
  delay: number;
  onChoose: (o: Offer) => void;
}) {
  const offers = offersFor(plan.id);
  const free = plan.id === "gratuit";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-2xl border p-4 shadow-soft ${
        plan.highlight
          ? "border-primary bg-gradient-to-br from-primary to-primary/85 text-primary-foreground"
          : "border-border/60 bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-serif text-xl font-semibold flex items-center gap-1.5">
            {plan.name}
            {plan.id === "vip" && <Crown className="w-4 h-4 text-gold" />}
          </div>
          <div className={`text-[11px] ${plan.highlight ? "opacity-85" : "text-muted-foreground"}`}>
            {plan.tagline}
          </div>
        </div>
        {current && (
          <span
            className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
              plan.highlight ? "bg-white/20" : "bg-primary/10 text-primary"
            }`}
          >
            Formule actuelle
          </span>
        )}
      </div>

      <p
        className={`mt-2.5 text-xs font-medium leading-snug ${
          plan.highlight ? "opacity-95" : "text-foreground/80"
        }`}
      >
        {plan.promise}
      </p>

      <ul className="mt-3 space-y-1.5 text-xs">
        {plan.perks.map(perk => (
          <li key={perk} className="flex gap-1.5">
            <Check
              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${plan.highlight ? "text-gold" : "text-primary"}`}
            />
            <span className={plan.highlight ? "opacity-95" : ""}>{perk}</span>
          </li>
        ))}
      </ul>

      {/* Ce que la formule ne couvre pas — le contraste fait la vente */}
      {plan.limits && plan.limits.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-xs border-t border-border/50 pt-2">
          {plan.limits.map(limit => (
            <li key={limit} className="flex gap-1.5 text-muted-foreground">
              <X className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />
              <span>{limit}</span>
            </li>
          ))}
        </ul>
      )}

      {free ? (
        <div
          className={`mt-4 w-full py-2.5 rounded-xl text-center text-xs font-semibold ${
            plan.highlight ? "bg-white/15" : "bg-secondary text-muted-foreground"
          }`}
        >
          Inclus par défaut
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {offers.map(offer => {
            const savings = savingsVsMonthly(offer);
            return (
              <button
                key={offer.id}
                onClick={() => onChoose(offer)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl font-semibold transition-all active:scale-[0.98] ${
                  plan.highlight
                    ? "bg-white text-primary hover:bg-white/90"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                <span className="flex items-center gap-2 text-sm">
                  {offer.label}
                  {offer.popular && (
                    <span className="px-1.5 py-0.5 rounded-full bg-gold text-gold-foreground text-[9px] uppercase tracking-wide">
                      Populaire
                    </span>
                  )}
                  {savings > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[9px] font-bold">
                      −{savings}%
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-sm">
                  {formatPrice(offer.priceXOF)}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
