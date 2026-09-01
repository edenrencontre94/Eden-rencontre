import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { formatPrice } from "@/lib/plans";
import {
  Gift, Users, CreditCard, ChevronRight, Check, X,
  Search, ShieldAlert, ToggleLeft, ToggleRight, DollarSign, SwitchCamera, ShieldCheck
} from "lucide-react";

export const Route = createFileRoute("/admin/parrainage")({
  head: () => ({
    meta: [{ title: "Parrainage — Admin Eden" }],
  }),
  component: AdminParrainagePage,
});

function AdminParrainagePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const { data: d, error } = await supabase.rpc("admin_affiliation");
    if (error) {
      toast.error("Erreur de chargement: " + error.message);
    } else {
      setData(d);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const setCodeActive = async (userId: string, active: boolean) => {
    const { error } = await supabase.rpc("admin_definir_parrain", {
      p_user: userId,
      p_active: active
    });
    if (error) toast.error("Erreur: " + error.message);
    else {
      toast.success(active ? "Parrain activé" : "Parrain désactivé");
      loadData();
    }
  };

  const payerRetrait = async (id: string) => {
    if (!confirm("Avez-vous bien envoyé l'argent par Mobile Money ?")) return;
    const { error } = await supabase.rpc("admin_payer_retrait", {
      p_payout: id,
      p_statut: "payee"
    });
    if (error) toast.error("Erreur: " + error.message);
    else {
      toast.success("Retrait marqué comme payé");
      loadData();
    }
  };

  const refuserRetrait = async (id: string) => {
    if (!confirm("Refuser ce retrait ? L'argent redeviendra disponible pour le parrain.")) return;
    const { error } = await supabase.rpc("admin_payer_retrait", {
      p_payout: id,
      p_statut: "refusee",
      p_note: "Refusé par l'administrateur"
    });
    if (error) toast.error("Erreur: " + error.message);
    else {
      toast.success("Retrait refusé");
      loadData();
    }
  };

  if (loading) return <div className="p-8">Chargement…</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" /> Parrainage
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les affiliés, suivez les commissions et payez les retraits.
          </p>
        </div>
        <div className="flex gap-2 text-sm font-medium">
          <div className="px-4 py-2 bg-card border border-border rounded-xl shadow-sm">
            Statut : <span className={data?.actif ? "text-emerald-600" : "text-destructive"}>{data?.actif ? "Actif" : "Inactif"}</span>
          </div>
          <div className="px-4 py-2 bg-card border border-border rounded-xl shadow-sm">
            Taux : {data?.taux} %
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Parrains actifs" value={data?.nb_parrains} />
        <StatCard label="Filleuls recrutés" value={data?.nb_filleuls} />
        <StatCard label="Dû (En attente)" value={formatPrice(data?.du_total)} color="text-gold" />
        <StatCard label="Total Payé" value={formatPrice(data?.paye_total)} color="text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne Gauche: Les Demandes de retrait */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5" /> Retraits en attente
          </h2>
          {(data?.retraits || []).filter((r: any) => r.statut === "demande").length === 0 && (
            <div className="p-6 text-center bg-card border border-border rounded-2xl text-muted-foreground text-sm">
              Aucun retrait en attente.
            </div>
          )}
          {(data?.retraits || []).filter((r: any) => r.statut === "demande").map((r: any) => (
            <div key={r.id} className="bg-card border border-gold/40 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{r.nom}</h3>
                  <p className="text-sm text-muted-foreground">Demande du {new Date(r.demande_le).toLocaleDateString("fr-FR")}</p>
                </div>
                <span className="text-lg font-bold text-foreground">{formatPrice(r.montant)}</span>
              </div>
              <div className="bg-secondary p-3 rounded-xl flex items-center justify-between">
                <span className="text-sm font-medium">Numéro Mobile Money :</span>
                <span className="font-mono font-bold tracking-wider">{r.numero}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => payerRetrait(r.id)}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition"
                >
                  <Check className="w-4 h-4" /> Marquer comme Payé
                </button>
                <button
                  onClick={() => refuserRetrait(r.id)}
                  className="px-4 py-2.5 bg-destructive/10 text-destructive rounded-xl text-sm font-semibold hover:bg-destructive/20 transition"
                >
                  <X className="w-4 h-4" /> Refuser
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Colonne Droite: Les Parrains */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" /> Liste des Parrains
          </h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-left text-muted-foreground uppercase text-xs tracking-wider">
                  <th className="p-4 font-medium">Parrain</th>
                  <th className="p-4 font-medium">Code</th>
                  <th className="p-4 font-medium text-right">Filleuls</th>
                  <th className="p-4 font-medium text-right">Gains</th>
                  <th className="p-4 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(data?.parrains || []).map((p: any) => (
                  <tr key={p.user_id} className={!p.active ? "opacity-50 bg-secondary/30" : ""}>
                    <td className="p-4 font-medium">{p.nom}</td>
                    <td className="p-4 font-mono font-bold">{p.code}</td>
                    <td className="p-4 text-right tabular-nums">{p.filleuls}</td>
                    <td className="p-4 text-right tabular-nums text-emerald-600 font-semibold">{formatPrice(p.gains)}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setCodeActive(p.user_id, !p.active)}
                        className={`text-xs px-3 py-1 rounded-full font-medium ${p.active ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20"}`}
                      >
                        {p.active ? "Couper" : "Réactiver"}
                      </button>
                    </td>
                  </tr>
                ))}
                {(data?.parrains || []).length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucun parrain.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-foreground" }: { label: string; value: any; color?: string }) {
  return (
    <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-serif font-bold ${color}`}>{value}</div>
    </div>
  );
}
