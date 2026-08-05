import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, ShieldX, AlertTriangle, RefreshCw, Ban, Inbox } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/moderation")({
  component: AdminModeration,
});

/**
 * Signalements réels, lus dans `reports` (migration 16).
 *
 * Cette page affichait quatre signalements inventés — « Marie L. a signalé
 * Paul K. » — pendant que les vrais s'accumulaient sans être vus. Une file
 * de modération fictive est pire qu'absente : elle donne le sentiment que
 * la surveillance est assurée.
 */

type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  context: string;
  reason: string | null;
  status: string;
  created_at: string;
};

const CONTEXT_LABELS: Record<string, string> = {
  profile: "Profil",
  message: "Conversation",
  community_post: "Publication",
  call: "Appel",
};

function AdminModeration() {
  const [reports, setReports] = useState<Report[]>([]);
  const [names, setNames] = useState<Map<string, { name: string; photo: string | null }>>(new Map());
  const [blockCount, setBlockCount] = useState<number | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("reports")
      .select("id, reporter_id, reported_id, context, reason, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (err) {
      console.error("[admin/moderation]", err);
      setError("Lecture impossible. La migration 31 a-t-elle été exécutée, et votre compte a-t-il le rôle admin ?");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Report[];
    setReports(rows);

    const ids = [...new Set(rows.flatMap(r => [r.reporter_id, r.reported_id]))];
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles").select("id, first_name, photos").in("id", ids);
      setNames(new Map((profiles ?? []).map((p: any) => [
        p.id, { name: p.first_name || "Membre", photo: p.photos?.[0] ?? null },
      ])));
    }

    // Les blocages entre membres complètent le tableau : un profil beaucoup
    // bloqué mérite l'attention même sans signalement formel.
    const { count } = await supabase
      .from("blocks").select("id", { count: "exact", head: true });
    setBlockCount(count ?? 0);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: "reviewed" | "dismissed" | "actioned") => {
    const previous = reports;
    setReports(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));

    const { error: err } = await supabase.from("reports").update({ status }).eq("id", id);

    if (err) {
      console.error("[admin/moderation] mise à jour:", err);
      setReports(previous);
      toast.error("Le statut n'a pas pu être enregistré");
      return;
    }
    toast.success(
      status === "actioned" ? "Signalement traité — sanction appliquée"
      : status === "dismissed" ? "Signalement écarté"
      : "Signalement marqué comme examiné",
    );
  };

  const visible = filter === "pending" ? reports.filter(r => r.status === "pending") : reports;
  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Modération</h1>
          <p className="text-muted-foreground mt-1">
            Signalements envoyés par les membres depuis l'application.
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={AlertTriangle} label="En attente de traitement" value={String(pendingCount)}
              warn={pendingCount > 0} />
        <Stat icon={Inbox} label="Signalements reçus" value={String(reports.length)} />
        <Stat icon={Ban} label="Blocages entre membres" value={blockCount === null ? "…" : String(blockCount)} />
      </div>

      <div className="flex gap-2">
        {([["pending", "À traiter"], ["all", "Tous"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/70"
            }`}
          >
            {label}{k === "pending" && pendingCount > 0 && ` · ${pendingCount}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-secondary animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">
            {filter === "pending"
              ? "Aucun signalement en attente. Tout est traité."
              : "Aucun signalement à ce jour."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(r => {
            const reported = names.get(r.reported_id);
            const reporter = names.get(r.reporter_id);

            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  {reported?.photo ? (
                    <img src={reported.photo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-serif font-semibold shrink-0">
                      {(reported?.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{reported?.name ?? "Membre supprimé"}</span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-semibold">
                        {CONTEXT_LABELS[r.context] ?? r.context}
                      </span>
                      <StatusPill status={r.status} />
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      {r.reason || "Aucun motif précisé"}
                    </p>

                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Signalé par {reporter?.name ?? "un membre"} ·{" "}
                      {new Date(r.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {r.status === "pending" && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
                    <button
                      onClick={() => setStatus(r.id, "actioned")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20"
                    >
                      <ShieldX className="w-3.5 h-3.5" /> Sanctionner
                    </button>
                    <button
                      onClick={() => setStatus(r.id, "reviewed")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold hover:bg-secondary/70"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Examiné
                    </button>
                    <button
                      onClick={() => setStatus(r.id, "dismissed")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold hover:bg-secondary/70"
                    >
                      Écarter
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        « Sanctionner » marque le signalement comme traité. La suspension effective
        du compte se fait depuis la page Utilisateurs — les deux actions sont
        volontairement séparées, pour qu'aucune sanction ne soit appliquée par
        simple réflexe depuis cette file.
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, warn }: {
  icon: any; label: string; value: string; warn?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${warn ? "border-gold/50 bg-gold/5" : "border-border bg-card"}`}>
      <Icon className={`w-5 h-5 ${warn ? "text-gold" : "text-primary"}`} />
      <div className="text-2xl font-serif font-bold mt-2">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "À traiter", cls: "bg-gold/20 text-gold-foreground" },
    reviewed: { label: "Examiné", cls: "bg-secondary text-muted-foreground" },
    dismissed: { label: "Écarté", cls: "bg-secondary text-muted-foreground" },
    actioned: { label: "Sanctionné", cls: "bg-destructive/10 text-destructive" },
  };
  const s = map[status] ?? { label: status, cls: "bg-secondary text-muted-foreground" };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>{s.label}</span>;
}
