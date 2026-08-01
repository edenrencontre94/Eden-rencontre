import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Crown, TrendingUp, Calendar } from "lucide-react";

export const Route = createFileRoute("/admin/abonnements")({
  component: AdminAbonnements,
});

const mockPlans = [
  { name: "Alliance — 1 mois", price: "9 990 FCFA", subscribers: 420, revenue: "4 195 800 FCFA", color: "bg-gold/10 text-gold" },
  { name: "Alliance — 3 mois", price: "24 990 FCFA", subscribers: 870, revenue: "21 741 300 FCFA", color: "bg-gold/10 text-gold" },
  { name: "Alliance — 6 mois", price: "44 990 FCFA", subscribers: 550, revenue: "24 744 500 FCFA", color: "bg-gold/10 text-gold" },
  { name: "Agape — Pass journalier", price: "1 500 FCFA", subscribers: 350, revenue: "525 000 FCFA", color: "bg-primary/10 text-primary" },
];

const mockTransactions = [
  { user: "Élodie M.", plan: "3 mois", amount: "24 990 FCFA", date: "01 août 2026", status: "success" },
  { user: "Christophe A.", plan: "1 mois", amount: "9 990 FCFA", date: "01 août 2026", status: "success" },
  { user: "Joëlle B.", plan: "6 mois", amount: "44 990 FCFA", date: "31 juil. 2026", status: "success" },
  { user: "Daniel K.", plan: "1 mois", amount: "9 990 FCFA", date: "31 juil. 2026", status: "failed" },
  { user: "Noémie T.", plan: "3 mois", amount: "24 990 FCFA", date: "30 juil. 2026", status: "success" },
  { user: "Samuel A.", plan: "6 mois", amount: "44 990 FCFA", date: "29 juil. 2026", status: "success" },
];

function AdminAbonnements() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold">Abonnements & Finances</h1>
        <p className="text-muted-foreground mt-1">Suivez les revenus et les abonnés Alliance.</p>
      </div>

      {/* MRR Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/90 to-primary p-8 text-primary-foreground shadow-elegant">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium opacity-80">Revenu Mensuel Récurrent (MRR)</p>
            <p className="text-5xl font-serif font-bold mt-2">50 681 600 <span className="text-2xl opacity-80">FCFA</span></p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-sm font-semibold">
              <TrendingUp className="w-4 h-4" /> +18.4% ce mois-ci
            </div>
            <p className="text-xs opacity-70 mt-3">1 840 abonnés Alliance • 350 abonnés Agape</p>
          </div>
        </div>
      </div>

      {/* Plans Cards */}
      <div>
        <h2 className="font-semibold text-lg mb-4">Performance par formule</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockPlans.map((plan) => (
            <div key={plan.name} className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <div className={`w-10 h-10 rounded-xl ${plan.color} flex items-center justify-center mb-4`}>
                <Crown className="w-5 h-5" />
              </div>
              <p className="font-semibold text-sm">{plan.name}</p>
              <p className="text-muted-foreground text-xs mt-1">{plan.price} / abonné</p>
              <div className="mt-4 pt-4 border-t border-border/40 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Abonnés actifs</span>
                  <span className="font-bold">{plan.subscribers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Revenus générés</span>
                  <span className="font-bold text-xs">{plan.revenue}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="font-semibold text-lg mb-4">Dernières transactions</h2>
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 bg-secondary/30">
                <tr>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membre</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formule</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Montant</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {mockTransactions.map((tx, i) => (
                  <tr key={i} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 font-medium">{tx.user}</td>
                    <td className="px-6 py-4 text-muted-foreground">Alliance {tx.plan}</td>
                    <td className="px-6 py-4 font-semibold">{tx.amount}</td>
                    <td className="px-6 py-4 text-muted-foreground">{tx.date}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        tx.status === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                      }`}>
                        {tx.status === "success" ? "✓ Succès" : "✗ Échec"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
