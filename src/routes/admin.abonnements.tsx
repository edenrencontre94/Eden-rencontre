import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/plans";
import {
  TrendingUp, Users, CreditCard, Clock, AlertTriangle, Rocket, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/admin/abonnements")({
  component: AdminAbonnements,
});

/**
 * Chiffres réels, lus dans `payments` et `subscriptions`.
 *
 * Cette page affichait auparavant des montants inventés — « MRR 50 681 600
 * FCFA », « Premium 1 mois à 9 990 FCFA » — alors que le tarif réel est de
 * 4 000 FCFA. Un tableau de bord qui ment est pire qu'un tableau de bord
 * vide : on prend des décisions dessus.
 */

type Payment = {
  id: string;
  user_id: string;
  offer_id: string;
  plan_id: string;
  amount_xof: number;
  status: string;
  created_at: string;
  completed_at: string | null;
};

const OFFER_LABELS: Record<string, string> = {
  premium_15j: "Premium 15 jours",
  premium_1m: "Premium 1 mois",
  premium_3m: "Premium 3 mois",
  vip_1m: "VIP 1 mois",
  boost_24h: "Boost 24 h",
  boost_3j: "Boost 3 jours",
  boost_7j: "Boost 7 jours",
};

/** Commission Chariow : le net est ce qui arrive réellement sur le compte. */
const CHARIOW_RATE = 0.15;

function AdminAbonnements() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [activeSubs, setActiveSubs] = useState<{ plan_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const [{ data: pay, error: payErr }, { data: subs, error: subErr }] = await Promise.all([
      supabase
        .from("payments")
        .select("id, user_id, offer_id, plan_id, amount_xof, status, created_at, completed_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("subscriptions")
        .select("plan_id, expires_at")
        .gt("expires_at", new Date().toISOString()),
    ]);

    if (payErr || subErr) {
      // Sans la policy admin, la RLS ne renvoie que ses propres lignes.
      // Mieux vaut le dire que d'afficher un tableau de bord à zéro.
      console.error("[admin/abonnements]", payErr ?? subErr);
      setError("Lecture impossible. La migration 31 a-t-elle été exécutée, et votre compte a-t-il le rôle admin ?");
      setLoading(false);
      return;
    }

    setPayments((pay ?? []) as Payment[]);
    setActiveSubs((subs ?? []) as any[]);

    const ids = [...new Set((pay ?? []).map((p: any) => p.user_id))];
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles").select("id, first_name").in("id", ids);
      setNames(new Map((profiles ?? []).map((p: any) => [p.id, p.first_name || "Membre"])));
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const completed = payments.filter(p => p.status === "completed");
  const pending = payments.filter(p => p.status === "pending");
  const failed = payments.filter(p => p.status === "failed");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const revenueTotal = completed.reduce((s, p) => s + p.amount_xof, 0);
  const revenueMonth = completed
    .filter(p => (p.completed_at ?? p.created_at) >= monthStart)
    .reduce((s, p) => s + p.amount_xof, 0);
  const boostRevenue = completed
    .filter(p => p.plan_id === "boost")
    .reduce((s, p) => s + p.amount_xof, 0);

  const byOffer = completed.reduce((acc, p) => {
    acc[p.offer_id] = (acc[p.offer_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const vipCount = activeSubs.filter(s => s.plan_id === "vip").length;
  const premiumCount = activeSubs.filter(s => s.plan_id === "premium").length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Abonnements & Finances</h1>
          <p className="text-muted-foreground mt-1">
            Chiffres calculés depuis les paiements réellement encaissés.
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm hover:bg-secondary"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-secondary animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="rounded-3xl bg-gradient-to-br from-primary/90 to-primary p-8 text-primary-foreground shadow-elegant">
            <p className="text-sm font-medium opacity-80">Encaissé ce mois-ci</p>
            <p className="text-4xl sm:text-5xl font-serif font-bold mt-2">{formatPrice(revenueMonth)}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-90">
              <span>
                Net après commission :{" "}
                <strong>{formatPrice(Math.round(revenueMonth * (1 - CHARIOW_RATE)))}</strong>
              </span>
              <span className="hidden sm:inline">·</span>
              <span>Total cumulé : <strong>{formatPrice(revenueTotal)}</strong></span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Users} label="Abonnés actifs" value={String(premiumCount + vipCount)}
                  hint={`${premiumCount} Premium · ${vipCount} VIP`} />
            <Stat icon={CreditCard} label="Paiements réglés" value={String(completed.length)}
                  hint={`sur ${payments.length} initiés`} />
            <Stat icon={Clock} label="En attente" value={String(pending.length)}
                  hint={pending.length > 0 ? "à surveiller" : "rien en suspens"}
                  warn={pending.length > 0} />
            <Stat icon={Rocket} label="Revenus Boost" value={formatPrice(boostRevenue)}
                  hint="achats à l'unité" />
          </div>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Ce qui se vend
            </h2>
            {Object.keys(byOffer).length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">Aucune vente enregistrée pour l'instant.</p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {Object.entries(byOffer)
                  .sort((a, b) => b[1] - a[1])
                  .map(([offer, count]) => {
                    const max = Math.max(...Object.values(byOffer));
                    return (
                      <div key={offer} className="flex items-center gap-3">
                        <span className="text-sm w-36 sm:w-44 shrink-0">{OFFER_LABELS[offer] ?? offer}</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all"
                               style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="text-sm font-semibold w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-serif text-lg font-semibold">Dernières transactions</h2>
            </div>

            {payments.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Aucun paiement enregistré.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Membre</th>
                      <th className="text-left px-4 py-2.5 font-medium">Offre</th>
                      <th className="text-right px-4 py-2.5 font-medium">Montant</th>
                      <th className="text-left px-4 py-2.5 font-medium">Statut</th>
                      <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.slice(0, 30).map(p => (
                      <tr key={p.id} className="hover:bg-secondary/30">
                        <td className="px-4 py-2.5">{names.get(p.user_id) ?? "—"}</td>
                        <td className="px-4 py-2.5">{OFFER_LABELS[p.offer_id] ?? p.offer_id}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatPrice(p.amount_xof)}</td>
                        <td className="px-4 py-2.5"><StatusPill status={p.status} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {failed.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {failed.length} paiement{failed.length > 1 ? "s" : ""} échoué{failed.length > 1 ? "s" : ""} —
              abandons au moment du règlement, sans incidence sur les revenus.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, warn }: {
  icon: any; label: string; value: string; hint?: string; warn?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${warn ? "border-gold/50 bg-gold/5" : "border-border bg-card"}`}>
      <Icon className={`w-5 h-5 ${warn ? "text-gold" : "text-primary"}`} />
      <div className="text-2xl font-serif font-bold mt-2">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Réglé", cls: "bg-emerald-500/15 text-emerald-600" },
    pending: { label: "En attente", cls: "bg-gold/20 text-gold-foreground" },
    failed: { label: "Échoué", cls: "bg-destructive/10 text-destructive" },
    refunded: { label: "Remboursé", cls: "bg-secondary text-muted-foreground" },
  };
  const s = map[status] ?? { label: status, cls: "bg-secondary text-muted-foreground" };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}
