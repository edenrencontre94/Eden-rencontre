import { createFileRoute } from "@tanstack/react-router";
import { Users, CreditCard, Heart, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function StatCard({ title, value, change, icon: Icon, trend }: { title: string, value: string, change: string, icon: any, trend: 'up' | 'down' }) {
  return (
    <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <div className="text-3xl font-bold font-serif mb-1">{value}</div>
        <div className={`text-xs font-semibold ${trend === 'up' ? 'text-emerald-500' : 'text-destructive'}`}>
          {trend === 'up' ? '↑' : '↓'} {change} depuis le mois dernier
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Vue d'ensemble</h1>
        <p className="text-muted-foreground mt-1">Bienvenue sur le centre de contrôle AgapeMeet.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Utilisateurs Actifs (MAU)" value="12,450" change="+14.5%" icon={Users} trend="up" />
        <StatCard title="Abonnés Alliance" value="1,840" change="+8.2%" icon={CreditCard} trend="up" />
        <StatCard title="Matchs ce mois-ci" value="4,210" change="+22.4%" icon={Heart} trend="up" />
        <StatCard title="Signalements ouverts" value="12" change="-3.1%" icon={AlertTriangle} trend="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area placeholder */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col">
          <h3 className="font-semibold text-lg mb-6">Croissance des inscriptions</h3>
          <div className="flex-1 flex items-end justify-between gap-2 px-4 pb-4 border-b border-border/30">
            {/* Mock bars for a chart */}
            {[40, 50, 35, 70, 60, 90, 85, 110, 100, 130, 120, 150].map((h, i) => (
              <div key={i} className="w-full bg-primary/20 rounded-t-sm hover:bg-primary transition-colors relative group" style={{ height: `${(h / 150) * 100}%` }}>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity">
                  {h}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground uppercase font-semibold px-4">
            <span>Jan</span><span>Fév</span><span>Mar</span><span>Avr</span><span>Mai</span><span>Juin</span>
            <span>Juil</span><span>Août</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Déc</span>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col">
          <h3 className="font-semibold text-lg mb-4">Activité récente</h3>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            {[
              { text: "Nouveau compte vérifié : Sarah, 26 ans", time: "Il y a 5 min", type: "success" },
              { text: "Nouvel abonnement Alliance (1 mois)", time: "Il y a 12 min", type: "gold" },
              { text: "Signalement reçu pour le profil #4892", time: "Il y a 34 min", type: "destructive" },
              { text: "Match exceptionnel (98% compat.)", time: "Il y a 1h", type: "primary" },
              { text: "Nouvel abonnement Alliance (6 mois)", time: "Il y a 2h", type: "gold" },
            ].map((activity, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    activity.type === 'success' ? 'bg-emerald-500' :
                    activity.type === 'gold' ? 'bg-gold' :
                    activity.type === 'destructive' ? 'bg-destructive' : 'bg-primary'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{activity.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-sm text-primary font-medium hover:bg-primary/10 rounded-xl transition-colors">
            Voir tout l'historique
          </button>
        </div>
      </div>
    </div>
  );
}
