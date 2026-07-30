import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  Wallet,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  PLANS,
  formatPrice,
  useSubscription,
  type BillingCycle,
  type Plan,
  type PlanId,
} from "@/lib/subscription";

export const Route = createFileRoute("/app/abonnement")({
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

const paymentMethods = [
  { id: "momo", label: "Mobile Money", hint: "MTN, Moov, Orange, Wave", icon: Smartphone },
  { id: "card", label: "Carte bancaire", hint: "Visa, Mastercard", icon: CreditCard },
  { id: "paypal", label: "PayPal", hint: "Paiement international", icon: Wallet },
] as const;

type MethodId = (typeof paymentMethods)[number]["id"];

function SubscriptionPage() {
  const { plan, planId, cycle, renewsOn, isPaid, superLikesLeft, boostsLeft, subscribe, cancel } =
    useSubscription();
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(cycle);
  const [checkout, setCheckout] = useState<Plan | null>(null);

  return (
    <div className="px-4 pt-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/15 text-gold text-[11px] font-semibold">
          <Crown className="w-3.5 h-3.5" /> Abonnement
        </div>
        <h1 className="font-serif text-2xl font-semibold mt-2">Passez au niveau supérieur</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Voyez vos visiteurs, envoyez des Super Likes illimités et boostez votre profil.
        </p>
      </div>

      {/* Statut actuel */}
      <div className="mt-5 rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Formule actuelle
            </div>
            <div className="font-serif text-lg font-semibold flex items-center gap-2">
              {plan.name}
              {isPaid && <BadgeCheck className="w-4 h-4 text-gold" />}
            </div>
            {isPaid && renewsOn && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Renouvellement le {new Date(renewsOn).toLocaleDateString("fr-FR")} · {cycle}
              </div>
            )}
          </div>
          {isPaid && (
            <button
              onClick={() => {
                cancel();
                toast.info("Abonnement annulé. Vous repassez en formule Gratuit.");
              }}
              className="text-xs font-medium text-muted-foreground hover:text-destructive underline underline-offset-4"
            >
              Annuler
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <Quota
            icon={Star}
            label="Super Likes"
            value={superLikesLeft === -1 ? "∞" : `${superLikesLeft}`}
            sub="restants aujourd'hui"
          />
          <Quota
            icon={Zap}
            label="Boosts"
            value={boostsLeft === -1 ? "∞" : `${boostsLeft}`}
            sub="restants ce mois"
          />
          <Quota
            icon={Eye}
            label="Visiteurs"
            value={plan.features.visitors ? "Oui" : "Non"}
            sub="accès au détail"
          />
        </div>
      </div>

      {/* Cycle */}
      <div className="mt-6 flex justify-center">
        <div className="inline-flex p-1 rounded-full bg-secondary/70 border border-border/60">
          {(["mensuel", "annuel"] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCycle(c)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCycle === c
                  ? "bg-background text-foreground shadow-soft"
                  : "text-muted-foreground"
              }`}
            >
              {c === "mensuel" ? "Mensuel" : "Annuel"}
              {c === "annuel" && <span className="ml-1 text-gold">-30%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="mt-4 space-y-3">
        {PLANS.map((p, i) => (
          <PlanCard
            key={p.id}
            plan={p}
            cycle={selectedCycle}
            current={p.id === planId}
            delay={i * 0.05}
            onChoose={() => setCheckout(p)}
          />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border/60 bg-secondary/40 p-4 text-[11px] text-muted-foreground leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-primary mb-1.5" />
        Paiement sécurisé, sans engagement : vous pouvez annuler à tout moment depuis cette page.
        Les paiements sont actuellement en mode démonstration — la connexion au prestataire de
        paiement sera activée à la mise en production.
      </div>

      <AnimatePresence>
        {checkout && (
          <CheckoutSheet
            plan={checkout}
            cycle={selectedCycle}
            onClose={() => setCheckout(null)}
            onPaid={(id) => {
              subscribe(id, selectedCycle);
              setCheckout(null);
              toast.success("Paiement confirmé — bienvenue dans votre nouvelle formule ✨");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Quota({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Star;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/50 border border-border/50 p-2.5 text-center">
      <Icon className="w-4 h-4 mx-auto text-primary" />
      <div className="font-serif text-lg leading-none mt-1">{value}</div>
      <div className="text-[10px] font-medium mt-1">{label}</div>
      <div className="text-[9px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function PlanCard({
  plan,
  cycle,
  current,
  delay,
  onChoose,
}: {
  plan: Plan;
  cycle: BillingCycle;
  current: boolean;
  delay: number;
  onChoose: () => void;
}) {
  const price = cycle === "annuel" ? plan.priceYearly : plan.priceMonthly;
  const free = plan.id === "gratuit";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`relative rounded-3xl border p-5 ${
        plan.highlight
          ? "border-gold/60 bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-elegant"
          : "border-border/60 bg-card shadow-soft"
      }`}
    >
      {plan.highlight && (
        <span className="absolute -top-2.5 left-5 px-2.5 py-0.5 rounded-full bg-gold text-gold-foreground text-[10px] font-bold shadow-soft">
          Le plus choisi
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-serif text-xl font-semibold">{plan.name}</div>
          <div className={`text-[11px] ${plan.highlight ? "opacity-85" : "text-muted-foreground"}`}>
            {plan.tagline}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-serif text-xl font-semibold">
            {free ? "0 FCFA" : formatPrice(price)}
          </div>
          <div className={`text-[10px] ${plan.highlight ? "opacity-85" : "text-muted-foreground"}`}>
            {free ? "pour toujours" : cycle === "annuel" ? "par an" : "par mois"}
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2 text-xs">
            <Check
              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${plan.highlight ? "text-gold" : "text-primary"}`}
            />
            <span className={plan.highlight ? "opacity-95" : ""}>{perk}</span>
          </li>
        ))}
      </ul>

      <button
        disabled={current || free}
        onClick={onChoose}
        className={`mt-5 w-full py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
          plan.highlight
            ? "bg-gold text-gold-foreground shadow-elegant hover:brightness-105"
            : "bg-primary text-primary-foreground hover:brightness-110"
        }`}
      >
        {current ? "Formule actuelle" : free ? "Inclus par défaut" : `Choisir ${plan.name}`}
      </button>
    </motion.div>
  );
}

function CheckoutSheet({
  plan,
  cycle,
  onClose,
  onPaid,
}: {
  plan: Plan;
  cycle: BillingCycle;
  onClose: () => void;
  onPaid: (id: PlanId) => void;
}) {
  const [method, setMethod] = useState<MethodId>("momo");
  const [phone, setPhone] = useState("");
  const [card, setCard] = useState("");
  const [loading, setLoading] = useState(false);
  const price = cycle === "annuel" ? plan.priceYearly : plan.priceMonthly;

  const pay = () => {
    if (method === "momo" && phone.trim().length < 8) {
      toast.error("Entrez un numéro Mobile Money valide");
      return;
    }
    if (method === "card" && card.replace(/\s/g, "").length < 12) {
      toast.error("Entrez un numéro de carte valide");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onPaid(plan.id);
    }, 1400);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Paiement</h2>
          <button
            aria-label="Fermer"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-secondary/60 border border-border/50 p-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gold" /> AgapeMeet {plan.name}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Abonnement {cycle} · sans engagement
            </div>
          </div>
          <div className="font-serif text-lg font-semibold">{formatPrice(price)}</div>
        </div>

        <div className="mt-4 space-y-2">
          {paymentMethods.map((m) => {
            const Icon = m.icon;
            const on = method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                  on ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/40"
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
                </span>
                {on && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>

        {method === "momo" && (
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="Numéro Mobile Money (ex. 90 00 00 00)"
            className="mt-3 w-full px-4 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
          />
        )}
        {method === "card" && (
          <input
            value={card}
            onChange={(e) => setCard(e.target.value)}
            inputMode="numeric"
            placeholder="Numéro de carte"
            className="mt-3 w-full px-4 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
          />
        )}
        {method === "paypal" && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Vous serez redirigé vers PayPal pour finaliser le paiement.
          </p>
        )}

        <button
          onClick={pay}
          disabled={loading}
          className="mt-4 w-full py-3 rounded-full bg-primary text-primary-foreground font-semibold shadow-elegant inline-flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Paiement en cours…
            </>
          ) : (
            <>Payer {formatPrice(price)}</>
          )}
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Mode démonstration — aucun montant réel n'est débité.
        </p>
      </motion.div>
    </motion.div>
  );
}