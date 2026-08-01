import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, Shield, Globe, Wrench, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/parametres")({
  component: AdminParametres,
});

function AdminParametres() {
  const [maintenance, setMaintenance] = useState(false);
  const [allowRegistrations, setAllowRegistrations] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [superLikesPerDay, setSuperLikesPerDay] = useState("1");
  const [boostsPerMonth, setBoostsPerMonth] = useState("3");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    toast.success("Paramètres enregistrés ✅");
    setSaving(false);
  };

  const Toggle = ({ checked, onChange, label, description }: { checked: boolean, onChange: (v: boolean) => void, label: string, description: string }) => (
    <div className="flex items-center justify-between py-4 border-b border-border/40 last:border-0">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold">Paramètres du Système</h1>
        <p className="text-muted-foreground mt-1">Configurez le comportement global de l'application.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* App Config */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-lg">Configuration générale</h2>
          </div>
          <div>
            <Toggle
              checked={maintenance}
              onChange={setMaintenance}
              label="Mode maintenance"
              description="L'app affichera une page de maintenance aux utilisateurs."
            />
            <Toggle
              checked={allowRegistrations}
              onChange={setAllowRegistrations}
              label="Autoriser les inscriptions"
              description="Désactivez pour bloquer de nouveaux comptes."
            />
            <Toggle
              checked={requireApproval}
              onChange={setRequireApproval}
              label="Approbation manuelle des profils"
              description="Chaque nouveau profil devra être approuvé avant d'être visible."
            />
          </div>
        </div>

        {/* Limits Config */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-lg">Limites & Quotas (Gratuit)</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Super Likes par jour (Gratuit)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0" max="10"
                  value={superLikesPerDay}
                  onChange={e => setSuperLikesPerDay(e.target.value)}
                  className="w-24 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span className="text-sm text-muted-foreground">par jour</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Boosts par mois (Premium)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0" max="30"
                  value={boostsPerMonth}
                  onChange={e => setBoostsPerMonth(e.target.value)}
                  className="w-24 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span className="text-sm text-muted-foreground">par mois</span>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Accounts */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-secondary text-foreground flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-lg">Comptes Administrateurs</h2>
          </div>
          <div className="space-y-3">
            {[
              { name: "Super Admin", email: "admin@agapemeet.com", role: "Super Admin", badge: "bg-primary/10 text-primary" },
            ].map((admin, i) => (
              <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-xl px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                    {admin.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${admin.badge}`}>{admin.role}</span>
              </div>
            ))}
            <button className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
              + Ajouter un administrateur
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-elegant hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </div>
    </div>
  );
}
