import { useEffect, useState } from "react";
import {
  Users, Copy, Check, TrendingUp, Wallet, Clock,
  AlertTriangle, Gift, ChevronRight, Phone, BadgePercent,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { formatPrice, OFFERS } from "@/lib/plans";

type Filleul = {
  prenom: string;
  depuis: string | null;
  gains: number;
};

type Retrait = {
  montant: number;
  statut: "demande" | "payee" | "refusee";
  demande_le: string;
  paye_le: string | null;
};

type HistoLigne = {
  date: string;
  montant: number;
  base: number;
  taux: number;
  statut: string;
  mature_le: string;
};

type ParrainageData = {
  programme_actif: boolean;
  autorise?: boolean;
  code?: string;
  taux?: number;
  seuil?: number;
  maturation_jours?: number;
  filleuls_total?: number;
  filleuls_payants?: number;
  gains_total?: number;
  en_attente?: number;
  disponible?: number;
  paye?: number;
  retrait_en_cours?: boolean;
  filleuls?: Filleul[];
  historique?: HistoLigne[];
  retraits?: Retrait[];
};

const STATUT_RETRAIT: Record<string, { label: string; color: string }> = {
  demande: { label: "En attente", color: "text-gold" },
  payee: { label: "Payée", color: "text-emerald-600" },
  refusee: { label: "Refusée", color: "text-destructive" },
};

export function ParrainageDashboard() {
  const [data, setData] = useState<ParrainageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copie, setCopie] = useState(false);
  const [showRetrait, setShowRetrait] = useState(false);
  const [numero, setNumero] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    supabase.rpc("mon_parrainage").then(({ data: d, error }) => {
      if (error) {
        console.error("[parrainage]", error);
        setData({ programme_actif: false });
      } else {
        setData(d as ParrainageData);
      }
      setLoading(false);
    });
  }, []);

  const copierCode = async () => {
    if (!data?.code) return;
    const lien = `${window.location.origin}/inscription?ref=${data.code}`;
    await navigator.clipboard.writeText(lien).catch(() =>
      navigator.clipboard.writeText(data.code!)
    );
    setCopie(true);
    setTimeout(() => setCopie(false), 2500);
  };

  const demanderRetrait = async () => {
    if (numero.trim().length < 8) {
      toast.error("Entrez un numéro Mobile Money valide");
      return;
    }
    setEnvoi(true);
    const { data: res } = await supabase.rpc("demander_retrait", {
      p_numero: numero.trim(),
    });
    setEnvoi(false);
    const r = res as any;
    if (r?.ok) {
      toast.success(`Retrait de ${formatPrice(r.montant)} enregistré !`);
      setShowRetrait(false);
      setNumero("");
      // rafraîchir
      const { data: d } = await supabase.rpc("mon_parrainage");
      setData(d as ParrainageData);
    } else {
      const msgs: Record<string, string> = {
        non_autorise: "Vous n'êtes pas parrain.",
        demande_en_cours: "Vous avez déjà une demande en cours.",
        sous_le_seuil: `Solde insuffisant (minimum ${formatPrice(data?.seuil ?? 3000)}).`,
        numero_invalide: "Numéro invalide.",
      };
      toast.error(msgs[r?.raison] ?? "Erreur inattendue.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.programme_actif) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Gift className="w-10 h-10 text-muted-foreground/40 mx-auto" />
        <h2 className="font-serif text-xl font-semibold mt-4">
          Programme de parrainage
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Le programme n'est pas encore activé. Revenez bientôt !
        </p>
      </div>
    );
  }

  if (!data?.autorise) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Gift className="w-10 h-10 text-primary/40 mx-auto" />
        <h2 className="font-serif text-xl font-semibold mt-4">
          Programme de parrainage
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Votre compte n'est pas encore inscrit dans le programme.
          Contactez le support pour en faire la demande.
        </p>
      </div>
    );
  }

  const lien = `${window.location.origin}/inscription?ref=${data.code}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-serif text-2xl font-semibold flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" /> Parrainage
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gagnez {data.taux ?? 20} % de commission sur chaque abonnement de vos filleuls, à vie.
        </p>
      </div>

      {/* Table des gains */}
      <CommissionTable taux={data.taux ?? 20} seuil={data.seuil ?? 3000} maturation={data.maturation_jours ?? 7} />

      {/* Lien parrainage */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
          Votre lien d'invitation
        </p>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm font-mono bg-background rounded-xl px-3 py-2.5 border border-border truncate">
            {lien}
          </span>
          <button
            onClick={copierCode}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 hover:bg-primary/90 transition"
          >
            {copie ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copie ? "Copié !" : "Copier"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Code court : <strong className="text-foreground tracking-widest">{data.code}</strong>
        </p>
      </div>

      {/* Soldes */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SoldeCard
          icon={TrendingUp}
          label="Gains totaux"
          valeur={formatPrice(data.gains_total ?? 0)}
          couleur="text-emerald-600"
        />
        <SoldeCard
          icon={Clock}
          label="En maturation"
          valeur={formatPrice(data.en_attente ?? 0)}
          detail={`Disponible dans ${data.maturation_jours ?? 7} j`}
        />
        <SoldeCard
          icon={Wallet}
          label="Disponible"
          valeur={formatPrice(data.disponible ?? 0)}
          couleur={(data.disponible ?? 0) > 0 ? "text-primary" : ""}
        />
        <SoldeCard
          icon={Users}
          label="Filleuls"
          valeur={String(data.filleuls_total ?? 0)}
          detail={`${data.filleuls_payants ?? 0} ont payé`}
        />
      </div>

      {/* Alerte retrait */}
      {(data.disponible ?? 0) > 0 && !data.retrait_en_cours && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {formatPrice(data.disponible ?? 0)} disponibles au retrait
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Minimum : {formatPrice(data.seuil ?? 3000)}
            </p>
          </div>
          <button
            onClick={() => setShowRetrait(v => !v)}
            className="shrink-0 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition flex items-center gap-1.5"
          >
            Retirer <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {data.retrait_en_cours && (
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <p className="text-sm">
            Une demande de retrait est en cours de traitement.
            Vous recevrez votre paiement par Mobile Money sous 48–72 h.
          </p>
        </div>
      )}

      {/* Formulaire retrait */}
      {showRetrait && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" /> Numéro Mobile Money
          </h3>
          <p className="text-xs text-muted-foreground">
            Renseignez votre numéro Orange Money, Wave ou autre.
            Vérifiez-le soigneusement — il n'est pas modifiable après envoi.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              value={numero}
              onChange={e => setNumero(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={demanderRetrait}
              disabled={envoi}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {envoi ? "Envoi…" : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      {/* Filleuls */}
      {(data.filleuls ?? []).length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4">Mes filleuls</h3>
          <div className="space-y-2">
            {(data.filleuls ?? []).map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span className="font-medium">{f.prenom}</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground text-xs">
                    {f.depuis
                      ? new Date(f.depuis).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
                      : "–"}
                  </span>
                  <span className="font-semibold text-emerald-600">
                    {formatPrice(f.gains)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique des commissions */}
      {(data.historique ?? []).length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4">Historique des commissions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground text-left">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Base</th>
                  <th className="pb-2 text-right">Taux</th>
                  <th className="pb-2 text-right">Commission</th>
                  <th className="pb-2 text-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {(data.historique ?? []).map((h, i) => {
                  const mur = new Date(h.mature_le) <= new Date();
                  const statut = h.statut === "en_attente"
                    ? (mur ? "disponible" : "en_attente")
                    : h.statut;
                  const couleurs: Record<string, string> = {
                    disponible: "text-primary",
                    en_attente: "text-gold",
                    payee: "text-emerald-600",
                    annulee: "text-muted-foreground line-through",
                  };
                  const labels: Record<string, string> = {
                    disponible: "Disponible",
                    en_attente: "En attente",
                    payee: "Payée",
                    annulee: "Annulée",
                  };
                  return (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-2 text-muted-foreground text-xs">
                        {new Date(h.date).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatPrice(h.base)}</td>
                      <td className="py-2 text-right tabular-nums">{h.taux} %</td>
                      <td className="py-2 text-right tabular-nums font-semibold">{formatPrice(h.montant)}</td>
                      <td className={`py-2 text-right text-xs font-medium ${couleurs[statut] ?? ""}`}>
                        {labels[statut] ?? statut}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Retraits */}
      {(data.retraits ?? []).length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4">Mes retraits</h3>
          <div className="space-y-2">
            {(data.retraits ?? []).map((r, i) => {
              const s = STATUT_RETRAIT[r.statut] ?? { label: r.statut, color: "" };
              return (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div>
                    <span className="font-semibold">{formatPrice(r.montant)}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      {new Date(r.demande_le).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SoldeCard({
  icon: Icon,
  label,
  valeur,
  detail,
  couleur = "",
}: {
  icon: any;
  label: string;
  valeur: string;
  detail?: string;
  couleur?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="w-5 h-5 text-primary mb-2" />
      <div className={`text-xl font-serif font-bold ${couleur}`}>{valeur}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {detail && <div className="text-[11px] text-muted-foreground mt-0.5">{detail}</div>}
    </div>
  );
}

/** Tableau "Ce que vous gagnez" — offres Premium uniquement, sans VIP. */
function CommissionTable({ taux, seuil, maturation }: { taux: number; seuil: number; maturation: number }) {
  // Seules les offres premium (pas vip)
  const premiumOffers = OFFERS.filter(o => o.planId === "premium");

  const LABELS: Record<string, string> = {
    premium_15j: "Premium 15 jours",
    premium_1m: "Premium 1 mois",
    premium_3m: "Premium 3 mois",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <BadgePercent className="w-4 h-4 text-primary" /> Ce que vous gagnez
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="pb-2 text-muted-foreground font-medium text-xs uppercase tracking-wide">Offre</th>
              <th className="pb-2 text-muted-foreground font-medium text-xs uppercase tracking-wide text-right">Prix</th>
              <th className="pb-2 text-muted-foreground font-medium text-xs uppercase tracking-wide text-right">Votre commission</th>
            </tr>
          </thead>
          <tbody>
            {premiumOffers.map(offer => {
              const commission = Math.round(offer.priceXOF * taux / 100);
              return (
                <tr key={offer.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 font-medium">{LABELS[offer.id] ?? offer.label}</td>
                  <td className="py-3 text-right tabular-nums text-muted-foreground">{formatPrice(offer.priceXOF)}</td>
                  <td className="py-3 text-right tabular-nums font-bold text-primary">{formatPrice(commission)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
        Ces montants vous sont versés <strong className="text-foreground">à chaque renouvellement</strong>, pas une seule fois.
        Un filleul en Premium mensuel vous rapporte{" "}
        <strong className="text-foreground">
          {formatPrice(Math.round(4000 * taux / 100))}
        </strong>{" "}
        tous les mois tant qu'il reste abonné.
      </p>

      {/* Conditions de retrait */}
      <div className="mt-4 pt-4 border-t border-border/60 flex flex-col sm:flex-row gap-3">
        <div className="flex items-start gap-2 flex-1">
          <Wallet className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">Retrait minimum</p>
            <p className="text-xs text-muted-foreground mt-0.5">Le retrait devient possible à partir de <strong className="text-foreground">{formatPrice(seuil)}</strong>.</p>
          </div>
        </div>
        <div className="flex items-start gap-2 flex-1">
          <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">Délai de disponibilité</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chaque commission est disponible <strong className="text-foreground">{maturation} jours</strong> après le paiement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

