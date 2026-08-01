import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, ShieldX, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/moderation")({
  component: AdminModeration,
});

type ReportRow = {
  id: string;
  reporter_name: string;
  reported_name: string;
  reported_id: string;
  reported_photo: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
};

// Mock data since we don't have a reports table yet
const mockReports: ReportRow[] = [
  { id: "1", reporter_name: "Marie L.", reported_name: "Paul K.", reported_id: "", reported_photo: "https://api.dicebear.com/7.x/initials/svg?seed=PaulK", reason: "Faux profil - photo volée", status: "open", created_at: new Date().toISOString() },
  { id: "2", reporter_name: "Esther M.", reported_name: "David N.", reported_id: "", reported_photo: "https://api.dicebear.com/7.x/initials/svg?seed=DavidN", reason: "Messages inappropriés", status: "open", created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: "3", reporter_name: "Rachel B.", reported_name: "Samuel T.", reported_id: "", reported_photo: "https://api.dicebear.com/7.x/initials/svg?seed=SamuelT", reason: "Comportement agressif", status: "open", created_at: new Date(Date.now() - 3600000 * 8).toISOString() },
  { id: "4", reporter_name: "Lucie A.", reported_name: "Jonas E.", reported_id: "", reported_photo: "https://api.dicebear.com/7.x/initials/svg?seed=JonasE", reason: "Profil offensant", status: "resolved", created_at: new Date(Date.now() - 86400000).toISOString() },
];

function AdminModeration() {
  const [reports, setReports] = useState<ReportRow[]>(mockReports);
  const [activeTab, setActiveTab] = useState<"open" | "resolved">("open");

  const resolve = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: "resolved" as const } : r));
    toast.success("Signalement résolu ✓");
  };

  const dismiss = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: "dismissed" as const } : r));
    toast.info("Signalement ignoré");
  };

  const filtered = reports.filter(r => activeTab === "open" ? r.status === "open" : r.status !== "open");

  const formatDate = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold">Modération</h1>
        <p className="text-muted-foreground mt-1">Gérez les signalements et assurez la sécurité de la communauté.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-destructive">{reports.filter(r => r.status === "open").length}</div>
          <div className="text-xs text-muted-foreground mt-1">Signalements ouverts</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{reports.filter(r => r.status === "resolved").length}</div>
          <div className="text-xs text-muted-foreground mt-1">Résolus</div>
        </div>
        <div className="bg-secondary border border-border/50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold">{reports.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Total signalements</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-4">
        {(["open", "resolved"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {tab === "open" ? `🚨 Ouverts (${reports.filter(r => r.status === "open").length})` : `✅ Résolus (${reports.filter(r => r.status !== "open").length})`}
          </button>
        ))}
      </div>

      {/* Reports */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Aucun signalement ici</p>
            <p className="text-sm mt-1">La communauté est saine 🙌</p>
          </div>
        ) : (
          filtered.map(report => (
            <div key={report.id} className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 shadow-sm">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">Signalement contre</span>
                    <span className="px-2 py-0.5 bg-secondary rounded-lg text-sm font-medium">{report.reported_name}</span>
                    <span className="text-muted-foreground text-xs">par {report.reporter_name}</span>
                  </div>
                  <p className="text-sm mt-2 text-foreground/80">
                    <strong>Raison :</strong> {report.reason}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">{formatDate(report.created_at)}</p>
                </div>
              </div>
              {activeTab === "open" && (
                <div className="flex gap-2 items-center sm:flex-col sm:items-end shrink-0">
                  <button onClick={() => resolve(report.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-xs font-semibold transition-colors">
                    <ShieldCheck className="w-3.5 h-3.5" /> Résoudre
                  </button>
                  <button onClick={() => dismiss(report.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground text-xs font-semibold transition-colors">
                    <ShieldX className="w-3.5 h-3.5" /> Ignorer
                  </button>
                </div>
              )}
              {activeTab !== "open" && (
                <span className="text-xs text-emerald-600 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-xl self-start">Résolu ✓</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
