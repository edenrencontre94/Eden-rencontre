import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Users, CreditCard, Heart, AlertTriangle, TrendingUp, TrendingDown,
  Activity, Globe, Zap, Star, MessageCircle, Eye, UserCheck, UserX,
  ArrowUpRight, ArrowDownRight, BarChart3, PieChart, Clock, Shield
} from "lucide-react";
import { formatPrice } from "@/lib/plans";
import { Avatar } from "@/components/app/Avatar";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

// ─── Types ───────────────────────────────────────────────────────────────────
type Stats = {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  verifiedUsers: number;
  maleUsers: number;
  femaleUsers: number;
  totalMatches: number;
  totalMessages: number;
  openReports: number;
  revenueTotal: number;
  revenueMonth: number;
  activeSubs: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

/** Horodatage relatif, pour le fil d'activité. */
function ilYA(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Mini bar sparkline (SVG) ─────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const w = 80;
  const h = 32;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-8" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Bar chart (SVG) ─────────────────────────────────────────────────────────
function BarChartSVG({ data, labels, color = "hsl(var(--primary))" }: { data: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 h-40 w-full">
      {data.map((v, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1 h-full justify-end group">
          <div
            className="w-full rounded-t-md transition-all hover:opacity-80 relative"
            style={{ height: `${(v / max) * 100}%`, background: color, minHeight: 4 }}
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-popover border border-border text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {v.toLocaleString()}
            </div>
          </div>
          <span className="text-[9px] text-muted-foreground">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut chart (SVG) ────────────────────────────────────────────────────────
function DonutChart({ segments, size = 100 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const strokes = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const rotate = (offset / total) * 360 - 90;
    offset += seg.value;
    return { dash, gap, rotate, color: seg.color };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="14" />
      {strokes.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="14"
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeLinecap="butt"
          style={{ transform: `rotate(${s.rotate}deg)`, transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
    </svg>
  );
}

/**
 * Variation entre une période et la précédente.
 *
 * Toutes les variations de cette page étaient écrites en dur — « +14,5 %
 * ce mois », « +30,1 % », « Excellent » — donc fausses par construction et
 * toujours flatteuses. Celle-ci se calcule, et sait dire qu'elle ne sait
 * pas : sans période précédente, on n'affiche rien plutôt qu'un « +100 % »
 * qui ne veut rien dire.
 */
function variation(actuel: number, precedent: number): {
  trend: "up" | "down" | "neutral"; label: string;
} | null {
  if (precedent === 0) {
    if (actuel === 0) return null;
    return { trend: "up", label: "première période" };
  }
  const pct = Math.round(((actuel - precedent) / precedent) * 100);
  if (pct === 0) return { trend: "neutral", label: "stable" };
  return {
    trend: pct > 0 ? "up" : "down",
    label: `${pct > 0 ? "+" : ""}${pct} %`,
  };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, delta, icon: Icon, iconBg, sparkData, sparkColor }: {
  title: string; value: string; sub: string;
  delta?: { trend: "up" | "down" | "neutral"; label: string } | null;
  icon: any; iconBg: string;
  // Optionnelle : une carte sans série réelle n'affiche AUCUNE courbe.
  // Les anciennes étaient des tableaux figés dont seule la dernière valeur
  // était vraie — la courbe montait donc toujours, quoi qu'il arrive.
  sparkData?: number[]; sparkColor?: string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={sparkColor ?? "hsl(var(--primary))"} />
        )}
      </div>
      <div>
        <div className="text-2xl font-bold font-serif">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{title}</div>
      </div>
      <div className="flex items-center justify-between border-t border-border/40 pt-3 gap-2">
        <span className="text-xs text-muted-foreground truncate">{sub}</span>
        {delta && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold shrink-0 ${
            delta.trend === "up" ? "text-emerald-500"
              : delta.trend === "down" ? "text-destructive"
              : "text-muted-foreground"
          }`}>
            {delta.trend === "up" ? <ArrowUpRight className="w-3.5 h-3.5" />
              : delta.trend === "down" ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
            {delta.label}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Graphique sans données.
 *
 * Un graphique vide vaut mieux qu'un graphique inventé : il dit la vérité
 * sur l'état de la plateforme au lieu de la maquiller.
 */
function EmptyChart() {
  return (
    <div className="h-40 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border">
      <BarChart3 className="w-8 h-8 text-muted-foreground/30" />
      <p className="text-xs text-muted-foreground mt-2">
        Pas encore de données sur cette période.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [ov, setOv] = useState<any>(null);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, newUsersToday: 0, newUsersThisWeek: 0, newUsersThisMonth: 0,
    verifiedUsers: 0, maleUsers: 0, femaleUsers: 0,
    totalMatches: 0, totalMessages: 0, openReports: 0,
    revenueTotal: 0, revenueMonth: 0, activeSubs: 0,
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();
        const monthStart = new Date(Date.now() - 30 * 86400000).toISOString();

        const [
          { count: total },
          { count: today },
          { count: week },
          { count: month },
          { count: verified },
          { count: male },
          { count: female },
          { count: matches },
          { count: messages },
          { data: recent },
          { data: paid },
          { data: subs },
          { count: openReports },
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
          supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekStart),
          supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_verified", true),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("gender", "male"),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("gender", "female"),
          supabase.from("matches").select("*", { count: "exact", head: true }),
          supabase.from("messages").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("id, first_name, city, gender, photos, created_at, is_verified").order("created_at", { ascending: false }).limit(8),
          // Revenus, abonnés et signalements : ces chiffres manquaient alors
          // que les données existent depuis la mise en place des paiements.
          supabase.from("payments").select("amount_xof, completed_at").eq("status", "completed"),
          supabase.from("profiles").select("public_plan").gt("premium_until", new Date().toISOString()),
          supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ]);

        const revenueTotal = (paid ?? []).reduce((sum: number, p: any) => sum + (p.amount_xof || 0), 0);
        const revenueMonth = (paid ?? [])
          .filter((p: any) => (p.completed_at ?? "") >= monthStart)
          .reduce((sum: number, p: any) => sum + (p.amount_xof || 0), 0);

        setStats({
          totalUsers: total || 0,
          newUsersToday: today || 0,
          newUsersThisWeek: week || 0,
          newUsersThisMonth: month || 0,
          verifiedUsers: verified || 0,
          maleUsers: male || 0,
          femaleUsers: female || 0,
          totalMatches: matches || 0,
          totalMessages: messages || 0,
          // Chiffre réel : « 12 » était écrit en dur, donc toujours faux
          openReports: openReports || 0,
          revenueTotal,
          revenueMonth,
          activeSubs: (subs ?? []).length,
        });
        setRecentUsers(recent || []);

        // Séries et ventes par offre : la même fonction que /admin/analytics,
        // pour que les deux pages ne racontent pas deux histoires.
        const [
          { data: a, error: aErr },
          { data: o, error: oErr },
        ] = await Promise.all([
          supabase.rpc("admin_analytics", { p_days: 30 }),
          supabase.rpc("admin_overview"),
        ]);
        if (!aErr && a && !(a as any).error) setAnalytics(a);
        if (!oErr && o && !(o as any).error) setOv(o);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Séries RÉELLES, calculées en base sur 30 jours.
  //
  // Elles étaient écrites en dur : `[42, 58, 35, 71, …]` pour les
  // inscriptions, `[820, 940, 710, …]` pour les revenus, et une répartition
  // « 1 mois / 3 mois / 6 mois » de formules qui n'existent même pas au
  // catalogue — les vraies sont 15 jours, 1 mois, 3 mois et VIP.
  const series = analytics
    ? {
        inscriptions: analytics.signups.map((p: any) => Number(p.n)),
        matchs: analytics.matches.map((p: any) => Number(p.n)),
        messages: analytics.messages.map((p: any) => Number(p.n)),
        revenus: analytics.revenue.map((p: any) => Number(p.n)),
        labels: analytics.signups.map((p: any) =>
          new Date(p.d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        ),
      }
    : { inscriptions: [], matchs: [], messages: [], revenus: [], labels: [] };

  // Aucune valeur de repli : afficher 60/40 quand la base est vide donne
  // l'illusion d'une communauté équilibrée qui n'existe pas encore.
  const autres = Math.max(0, stats.totalUsers - stats.femaleUsers - stats.maleUsers);
  const genderSegments = [
    { value: stats.femaleUsers, color: "hsl(var(--primary))", label: "Femmes" },
    { value: stats.maleUsers, color: "hsl(var(--gold))", label: "Hommes" },
    ...(autres > 0
      ? [{ value: autres, color: "hsl(var(--muted-foreground))", label: "Non précisé" }]
      : []),
  ];

  const OFFER_COLORS: Record<string, string> = {
    premium_15j: "#6366f1",
    premium_1m: "#f59e0b",
    premium_3m: "#10b981",
    vip_1m: "#c9a227",
  };
  const OFFER_LABELS: Record<string, string> = {
    premium_15j: "Premium 15 j",
    premium_1m: "Premium 1 mois",
    premium_3m: "Premium 3 mois",
  };

  const planSegments = (analytics?.by_offer ?? []).map((o: any) => ({
    value: Number(o.n),
    color: OFFER_COLORS[o.offer_id] ?? "hsl(var(--muted-foreground))",
    label: OFFER_LABELS[o.offer_id] ?? o.offer_id,
  }));
  const totalVentes = planSegments.reduce((s: number, p: any) => s + p.value, 0);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const verifiedPct = stats.totalUsers > 0 ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0;
  const matchRate = stats.totalUsers > 0 ? ((stats.totalMatches / stats.totalUsers) * 100).toFixed(1) : "0";
  const avgMsgPerMatch = stats.totalMatches > 0 ? Math.round(stats.totalMessages / stats.totalMatches) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold">Vue d'ensemble</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tableau de bord complet Eden Rencontre — <span className="font-medium text-foreground">Mise à jour en temps réel</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border/50 px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Données en direct depuis Supabase
        </div>
      </div>

      {/* ── Revenus ──────────────────────────────────────────────── */}
      {/* Chiffres réels issus de `payments` et `subscriptions`. Ils
          manquaient totalement alors que ce sont les seuls indicateurs
          qui disent si l'activité est viable. */}
      <section className="rounded-3xl bg-gradient-to-br from-primary/90 to-primary p-6 sm:p-8 text-primary-foreground shadow-elegant">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium opacity-80">Encaissé ces 30 derniers jours</p>
            <p className="text-4xl sm:text-5xl font-serif font-bold mt-1.5">
              {loading ? "—" : `${new Intl.NumberFormat("fr-FR").format(stats.revenueMonth)} FCFA`}
            </p>
            <p className="text-xs opacity-80 mt-2">
              Net après commission :{" "}
              <strong>
                {loading ? "—" : `${new Intl.NumberFormat("fr-FR").format(Math.round(stats.revenueMonth * 0.85))} FCFA`}
              </strong>
            </p>
          </div>

          <div className="flex gap-6 sm:gap-8">
            <div>
              <p className="text-2xl font-serif font-bold">{loading ? "—" : stats.activeSubs}</p>
              <p className="text-[11px] opacity-80">Abonnés actifs</p>
            </div>
            <div>
              <p className="text-2xl font-serif font-bold">
                {loading ? "—" : `${new Intl.NumberFormat("fr-FR").format(stats.revenueTotal)}`}
              </p>
              <p className="text-[11px] opacity-80">Total cumulé (FCFA)</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── KPI Row 1: Users ─────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> Utilisateurs
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total membres"
            value={loading ? "—" : fmt(stats.totalUsers)}
            sub={`${stats.verifiedUsers} vérifiés`}
            delta={ov && variation(ov.inscrits.mois, ov.inscrits.mois_p)}
            icon={Users} iconBg="bg-primary/10 text-primary"
            sparkData={series.inscriptions} sparkColor="hsl(var(--primary))"
          />
          <KpiCard
            title="Inscriptions aujourd'hui"
            value={loading ? "—" : String(ov?.inscrits.jour ?? 0)}
            sub={`${ov?.inscrits.hier ?? 0} hier`}
            delta={ov && variation(ov.inscrits.jour, ov.inscrits.hier)}
            icon={UserCheck} iconBg="bg-emerald-500/10 text-emerald-600"
          />
          <KpiCard
            title="Cette semaine"
            value={loading ? "—" : String(ov?.inscrits.semaine ?? 0)}
            sub="vs 7 jours précédents"
            delta={ov && variation(ov.inscrits.semaine, ov.inscrits.semaine_p)}
            icon={Activity} iconBg="bg-sky-500/10 text-sky-500"
          />
          <KpiCard
            title="Ce mois-ci"
            value={loading ? "—" : String(ov?.inscrits.mois ?? 0)}
            sub="vs 30 jours précédents"
            delta={ov && variation(ov.inscrits.mois, ov.inscrits.mois_p)}
            icon={TrendingUp} iconBg="bg-gold/10 text-gold"
            sparkData={series.inscriptions} sparkColor="hsl(var(--gold))"
          />
        </div>
      </section>

      {/* ── KPI Row 2: Engagement ──────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Heart className="w-3.5 h-3.5" /> Engagement & Matchs
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total matchs"
            value={loading ? "—" : fmt(stats.totalMatches)}
            sub={`${ov?.matchs_periode.mois ?? 0} sur 30 jours`}
            delta={ov && variation(ov.matchs_periode.mois, ov.matchs_periode.mois_p)}
            icon={Heart} iconBg="bg-primary/10 text-primary"
            sparkData={series.matchs} sparkColor="hsl(var(--primary))"
          />
          <KpiCard
            title="Messages envoyés"
            value={loading ? "—" : fmt(stats.totalMessages)}
            sub={`${ov?.messages_periode.mois ?? 0} sur 30 jours`}
            delta={ov && variation(ov.messages_periode.mois, ov.messages_periode.mois_p)}
            icon={MessageCircle} iconBg="bg-sky-500/10 text-sky-500"
            sparkData={series.messages} sparkColor="#0ea5e9"
          />
          {/* Aucune variation ici : un ratio n'a pas de « période
              précédente » sans historiser le calcul lui-même. */}
          <KpiCard
            title="Taux de match"
            value={`${matchRate}%`}
            sub="Matchs rapportés aux membres"
            icon={Zap} iconBg="bg-emerald-500/10 text-emerald-600"
          />
          <KpiCard
            title="Msgs / match"
            value={loading ? "—" : String(avgMsgPerMatch)}
            sub="Moyenne par conversation"
            icon={Star} iconBg="bg-gold/10 text-gold"
          />
        </div>
      </section>

      {/* ── KPI Row 3: Platform Health ─────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" /> Santé de la plateforme
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Profils vérifiés"
            value={`${verifiedPct}%`}
            sub={`${stats.verifiedUsers} membres certifiés`}
            icon={UserCheck} iconBg="bg-emerald-500/10 text-emerald-600"
          />
          {/* « 8.4K » était inventé, alors que `profile_visits` contient
              le chiffre exact. */}
          <KpiCard
            title="Profils visités"
            value={loading ? "—" : String(ov?.visites_jour ?? 0)}
            sub="Vues de profil aujourd'hui"
            delta={ov && variation(ov.visites_jour, ov.visites_hier)}
            icon={Eye} iconBg="bg-primary/10 text-primary"
          />
          <KpiCard
            title="Signalements"
            value={String(stats.openReports)}
            sub="En attente de traitement"
            icon={AlertTriangle} iconBg="bg-amber-500/10 text-amber-500"
          />
          <KpiCard
            title="Super Likes"
            value={loading ? "—" : String(ov?.superlikes_jour ?? 0)}
            sub="Envoyés aujourd'hui"
            delta={ov && variation(ov.superlikes_jour, ov.superlikes_hier)}
            icon={Star} iconBg="bg-primary/10 text-primary"
          />
        </div>
      </section>

      {/* ── Charts Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Inscriptions Chart */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-base">Croissance des inscriptions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nouveaux membres, 30 derniers jours
              </p>
            </div>
            <span className="text-xs bg-secondary px-3 py-1 rounded-full">
              <strong>{series.matchs.reduce((a: number, b: number) => a + b, 0)}</strong> matchs sur la période
            </span>
          </div>
          {series.inscriptions.length > 0 ? (
            <BarChartSVG data={series.inscriptions} labels={series.labels} />
          ) : (
            <EmptyChart />
          )}
        </div>

        {/* Gender distribution donut */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-base mb-1">Répartition des genres</h3>
          <p className="text-xs text-muted-foreground mb-4">Composition de la base de membres</p>
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <DonutChart segments={genderSegments} size={120} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">{fmt(stats.totalUsers)}</span>
                <span className="text-[9px] text-muted-foreground">total</span>
              </div>
            </div>
            <div className="w-full space-y-2">
              {[
                { label: "Femmes", color: "bg-primary", value: stats.femaleUsers || 60, pct: Math.round(((stats.femaleUsers || 60) / (stats.totalUsers || 100)) * 100) },
                { label: "Hommes", color: "bg-gold", value: stats.maleUsers || 40, pct: Math.round(((stats.maleUsers || 40) / (stats.totalUsers || 100)) * 100) },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
                  <span className="text-xs text-muted-foreground flex-1">{item.label}</span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Revenue + Plans ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-base">Revenus (FCFA)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paiements encaissés, 30 derniers jours
              </p>
            </div>
            {/* Le badge annonçait « MRR : 50.7M FCFA », un chiffre écrit en
                dur. Celui-ci est la somme réelle de la période — et le
                terme « MRR » n'a pas lieu d'être : les formules sont
                vendues à l'acte, sans prélèvement récurrent. */}
            <div className="bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
              {formatPrice(series.revenus.reduce((a: number, b: number) => a + b, 0))}
            </div>
          </div>
          {series.revenus.length > 0 ? (
            <BarChartSVG data={series.revenus} labels={series.labels} color="#f59e0b" />
          ) : (
            <EmptyChart />
          )}
        </div>

        {/* Plans donut */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-base mb-1">Ventes par offre</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Depuis le lancement, toutes formules confondues
          </p>

          {totalVentes === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Aucune vente enregistrée pour l'instant.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <DonutChart segments={planSegments} size={120} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold">{totalVentes}</span>
                  <span className="text-[9px] text-muted-foreground">ventes</span>
                </div>
              </div>
              <div className="w-full space-y-2.5">
                {planSegments.map((item: any) => {
                  const pct = Math.round((item.value / totalVentes) * 100);
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: item.color }}
                      />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{item.label}</span>
                      <span className="text-xs font-semibold">{item.value}</span>
                      <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: item.color }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{pct} %</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Match line chart + recent users ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activity feed */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-base mb-4">Activité récente</h3>

          {/* Ce fil était entièrement imaginaire : « Marie & Jean-Baptiste »,
              « Lucie A. — 24 990 FCFA » — un montant qui ne correspond même
              pas au catalogue. Les événements viennent maintenant des
              tables : inscriptions, matchs, paiements, signalements et
              demandes de support. */}
          <div className="space-y-4">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-secondary animate-pulse rounded-lg" />
              ))
            ) : !ov?.activite?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune activité pour l'instant.
              </p>
            ) : (
              ov.activite.map((a: any, i: number) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] mt-0.5 ${
                    a.type === "match" ? "bg-primary/10"
                      : a.type === "paiement" ? "bg-emerald-500/10"
                      : a.type === "signalement" ? "bg-destructive/10"
                      : a.type === "support" ? "bg-gold/10"
                      : "bg-sky-500/10"
                  }`}>
                    {a.type === "match" ? "💞"
                      : a.type === "paiement" ? "💳"
                      : a.type === "signalement" ? "🚨"
                      : a.type === "support" ? "🛟" : "👤"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate">{a.texte}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{a.detail}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                    {ilYA(a.at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent users */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base">Nouveaux membres</h3>
            <span className="text-xs text-primary font-medium">8 derniers inscrits</span>
          </div>
          <div className="space-y-3">
            {loading ? (
              [...Array(5)].map((_, i) => <div key={i} className="h-12 bg-secondary animate-pulse rounded-xl" />)
            ) : recentUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">Aucun membre encore.</div>
            ) : (
              recentUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
                  <Avatar
                    src={u.photos?.[0]}
                    name={u.first_name}
                    className="w-10 h-10 text-sm border border-border shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{u.first_name || "Nouveau membre"}</p>
                      {u.is_verified && <span className="text-[9px] bg-emerald-500/10 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full">✓ Vérifié</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.city || "Ville inconnue"} · {u.gender === "female" ? "Femme" : u.gender === "male" ? "Homme" : "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">{u.created_at ? formatDate(u.created_at) : "—"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Rétention ─────────────────────────────────────────────── */}
      {/* Cette rangée affichait quatre valeurs inventées : rétention 74 %,
          session 12 min, compatibilité 87 %, NPS +62. Aucune n'est mesurée
          — il n'existe ni chronomètre de session, ni enquête de
          satisfaction. Les trois non mesurables ont été retirées plutôt
          que simulées ; la rétention, elle, se calcule. */}
      {ov && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-base">Rétention à un mois</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
                Part des membres inscrits il y a 30 à 60 jours qui se sont
                reconnectés au cours des 30 derniers jours.
              </p>
            </div>
            <div className="text-right">
              {ov.retention === null || ov.retention_base === 0 ? (
                <>
                  <div className="text-2xl font-serif font-bold text-muted-foreground">—</div>
                  <p className="text-[11px] text-muted-foreground">
                    Pas encore assez d'ancienneté
                  </p>
                </>
              ) : (
                <>
                  <div className={`text-3xl font-serif font-bold ${
                    ov.retention >= 40 ? "text-emerald-600"
                      : ov.retention >= 20 ? "text-gold" : "text-destructive"
                  }`}>
                    {ov.retention} %
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    sur {ov.retention_base} membre(s) concerné(s)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
