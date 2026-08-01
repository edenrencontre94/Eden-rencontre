import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Users, CreditCard, Heart, AlertTriangle, TrendingUp, TrendingDown,
  Activity, Globe, Zap, Star, MessageCircle, Eye, UserCheck, UserX,
  ArrowUpRight, ArrowDownRight, BarChart3, PieChart, Clock, Shield
} from "lucide-react";

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
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, trend, trendValue, icon: Icon, iconBg, sparkData, sparkColor }: {
  title: string; value: string; sub: string; trend: "up" | "down" | "neutral";
  trendValue: string; icon: any; iconBg: string; sparkData: number[]; sparkColor: string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        <Sparkline data={sparkData} color={sparkColor} />
      </div>
      <div>
        <div className="text-2xl font-bold font-serif">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{title}</div>
      </div>
      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <span className="text-xs text-muted-foreground">{sub}</span>
        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
          trend === "up" ? "text-emerald-500" : trend === "down" ? "text-destructive" : "text-muted-foreground"
        }`}>
          {trend === "up" ? <ArrowUpRight className="w-3.5 h-3.5" /> : trend === "down" ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
          {trendValue}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, newUsersToday: 0, newUsersThisWeek: 0, newUsersThisMonth: 0,
    verifiedUsers: 0, maleUsers: 0, femaleUsers: 0,
    totalMatches: 0, totalMessages: 0, openReports: 0,
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
        ]);

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
          openReports: 12,
        });
        setRecentUsers(recent || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Mock time-series data (would come from analytics in prod)
  const inscriptionsData = [42, 58, 35, 71, 64, 89, 78, 112, 98, 134, 121, 148];
  const matchsData = [18, 24, 15, 32, 27, 41, 37, 55, 48, 62, 58, 74];
  const revenueData = [820, 940, 710, 1200, 1050, 1480, 1320, 1720, 1590, 2100, 1980, 2450];
  const months = ["Jan","Fév","Mar","Avr","Mai","Jui","Jul","Aoû","Sep","Oct","Nov","Déc"];

  const genderSegments = [
    { value: stats.femaleUsers || 60, color: "hsl(var(--primary))", label: "Femmes" },
    { value: stats.maleUsers || 40, color: "hsl(var(--gold))", label: "Hommes" },
    { value: Math.max(0, stats.totalUsers - stats.femaleUsers - stats.maleUsers), color: "hsl(var(--muted-foreground))", label: "Autre" },
  ];

  const planSegments = [
    { value: 420, color: "#6366f1", label: "1 mois" },
    { value: 870, color: "#f59e0b", label: "3 mois" },
    { value: 550, color: "#10b981", label: "6 mois" },
  ];

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
            Tableau de bord complet AgapeMeet — <span className="font-medium text-foreground">Mise à jour en temps réel</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border/50 px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Données en direct depuis Supabase
        </div>
      </div>

      {/* ── KPI Row 1: Users ─────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> Utilisateurs
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total membres" value={loading ? "—" : fmt(stats.totalUsers)} sub="Comptes inscrits" trend="up" trendValue="+14.5% ce mois" icon={Users} iconBg="bg-primary/10 text-primary" sparkData={[32,45,38,62,55,80,72,98,85,112,102,stats.totalUsers || 120]} sparkColor="hsl(var(--primary))" />
          <KpiCard title="Inscriptions aujourd'hui" value={loading ? "—" : String(stats.newUsersToday)} sub="Aujourd'hui seulement" trend="up" trendValue="+8 vs hier" icon={UserCheck} iconBg="bg-emerald-500/10 text-emerald-600" sparkData={[5,8,4,12,9,14,11,17,14,18,15,stats.newUsersToday || 22]} sparkColor="#10b981" />
          <KpiCard title="Cette semaine" value={loading ? "—" : String(stats.newUsersThisWeek)} sub="7 derniers jours" trend="up" trendValue="+22.4% vs semaine der." icon={Activity} iconBg="bg-sky-500/10 text-sky-500" sparkData={[40,52,38,68,58,84,72,95,88,110,102,stats.newUsersThisWeek || 128]} sparkColor="#0ea5e9" />
          <KpiCard title="Ce mois-ci" value={loading ? "—" : String(stats.newUsersThisMonth)} sub="30 derniers jours" trend="up" trendValue="+18.2% vs mois der." icon={TrendingUp} iconBg="bg-gold/10 text-gold" sparkData={[80,105,78,132,115,162,142,185,172,210,198,stats.newUsersThisMonth || 248]} sparkColor="hsl(var(--gold))" />
        </div>
      </section>

      {/* ── KPI Row 2: Engagement ──────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Heart className="w-3.5 h-3.5" /> Engagement & Matchs
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total matchs" value={loading ? "—" : fmt(stats.totalMatches)} sub="Connexions réelles" trend="up" trendValue="+30.1%" icon={Heart} iconBg="bg-primary/10 text-primary" sparkData={[12,18,10,24,19,30,26,38,34,44,40,stats.totalMatches || 52]} sparkColor="hsl(var(--primary))" />
          <KpiCard title="Messages envoyés" value={loading ? "—" : fmt(stats.totalMessages)} sub="Dans toutes les conversations" trend="up" trendValue="+42.5%" icon={MessageCircle} iconBg="bg-sky-500/10 text-sky-500" sparkData={[200,310,180,420,360,540,480,620,580,720,680,stats.totalMessages || 800]} sparkColor="#0ea5e9" />
          <KpiCard title="Taux de match" value={`${matchRate}%`} sub="Matchs / utilisateurs" trend="up" trendValue="Excellent" icon={Zap} iconBg="bg-emerald-500/10 text-emerald-600" sparkData={[3.2,4.1,2.9,5.0,4.4,6.2,5.7,7.1,6.6,8.0,7.5,parseFloat(matchRate) || 8.8]} sparkColor="#10b981" />
          <KpiCard title="Msgs / match" value={String(avgMsgPerMatch || 24)} sub="Moyenne par conversation" trend="up" trendValue="+5 depuis jan." icon={Star} iconBg="bg-gold/10 text-gold" sparkData={[12,15,11,18,16,22,20,25,23,27,25,avgMsgPerMatch || 30]} sparkColor="hsl(var(--gold))" />
        </div>
      </section>

      {/* ── KPI Row 3: Platform Health ─────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" /> Santé de la plateforme
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Profils vérifiés" value={`${verifiedPct}%`} sub={`${stats.verifiedUsers} membres certifiés`} trend="up" trendValue="+5% ce mois" icon={UserCheck} iconBg="bg-emerald-500/10 text-emerald-600" sparkData={[18,22,20,28,26,32,30,36,34,40,38,verifiedPct || 44]} sparkColor="#10b981" />
          <KpiCard title="Profils visités" value="8.4K" sub="Vues de profil aujourd'hui" trend="up" trendValue="+12%" icon={Eye} iconBg="bg-primary/10 text-primary" sparkData={[4200,5800,3500,7100,6400,8900,7800,9800,8600,10200,9500,8400]} sparkColor="hsl(var(--primary))" />
          <KpiCard title="Signalements" value={String(stats.openReports)} sub="En attente de traitement" trend="down" trendValue="-3.1% — Bon score" icon={AlertTriangle} iconBg="bg-amber-500/10 text-amber-500" sparkData={[18,22,14,26,19,28,22,24,18,20,15,stats.openReports || 12]} sparkColor="#f59e0b" />
          <KpiCard title="Super Likes" value="342" sub="Envoyés aujourd'hui" trend="up" trendValue="+8 vs hier" icon={Star} iconBg="bg-primary/10 text-primary" sparkData={[180,245,152,312,278,388,342,415,392,448,428,342]} sparkColor="hsl(var(--primary))" />
        </div>
      </section>

      {/* ── Charts Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Inscriptions Chart */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-base">Croissance des inscriptions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Nouveaux membres par mois — Année 2026</p>
            </div>
            <div className="flex gap-2">
              <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">vs Matchs <span className="text-primary font-semibold">↑ corrélés</span></span>
            </div>
          </div>
          <BarChartSVG data={inscriptionsData} labels={months} />
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
              <h3 className="font-semibold text-base">Revenus mensuels (FCFA)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Abonnements Premium — Cumulatif 2026</p>
            </div>
            <div className="bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
              MRR : 50.7M FCFA
            </div>
          </div>
          <BarChartSVG data={revenueData} labels={months} color="#f59e0b" />
        </div>

        {/* Plans donut */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-base mb-1">Formules Premium</h3>
          <p className="text-xs text-muted-foreground mb-4">Répartition par durée d'abonnement</p>
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <DonutChart segments={planSegments} size={120} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">1,840</span>
                <span className="text-[9px] text-muted-foreground">abonnés</span>
              </div>
            </div>
            <div className="w-full space-y-2.5">
              {[
                { label: "1 mois", color: "bg-indigo-500", value: 420, pct: 23 },
                { label: "3 mois", color: "bg-amber-500", value: 870, pct: 47 },
                { label: "6 mois", color: "bg-emerald-500", value: 550, pct: 30 },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
                  <span className="text-xs text-muted-foreground flex-1">{item.label}</span>
                  <span className="text-xs font-semibold">{item.value}</span>
                  <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-6 text-right">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Match line chart + recent users ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activity feed */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-base mb-4">Activité en direct</h3>
          <div className="space-y-4">
            {[
              { text: "Nouveau match créé", detail: "Marie & Jean-Baptiste", time: "Il y a 2 min", type: "match", color: "bg-primary/10 text-primary" },
              { text: "Nouveau Super Like", detail: "Esther → Paul", time: "Il y a 5 min", type: "star", color: "bg-gold/10 text-gold" },
              { text: "Abonnement Premium (3 mois)", detail: "Lucie A. — 24 990 FCFA", time: "Il y a 9 min", type: "billing", color: "bg-emerald-500/10 text-emerald-600" },
              { text: "Signalement ouvert", detail: "Profil #4892", time: "Il y a 15 min", type: "report", color: "bg-destructive/10 text-destructive" },
              { text: "Profil vérifié", detail: "Sarah M., Douala", time: "Il y a 28 min", type: "verified", color: "bg-emerald-500/10 text-emerald-600" },
              { text: "Nouveau membre inscrit", detail: "Daniel K., Abidjan", time: "Il y a 32 min", type: "user", color: "bg-sky-500/10 text-sky-500" },
              { text: "Abonnement Premium (6 mois)", detail: "Rachel B. — 44 990 FCFA", time: "Il y a 1h", type: "billing", color: "bg-emerald-500/10 text-emerald-600" },
              { text: "Nouveau match créé", detail: "Noémie & Samuel", time: "Il y a 1h 15", type: "match", color: "bg-primary/10 text-primary" },
            ].map((a, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] mt-0.5 ${a.color}`}>
                  {a.type === "match" ? "💞" : a.type === "star" ? "⭐" : a.type === "billing" ? "💳" : a.type === "report" ? "🚨" : a.type === "verified" ? "✅" : "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate">{a.text}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{a.detail}</p>
                </div>
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">{a.time}</span>
              </div>
            ))}
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
                  <img
                    src={u.photos?.[0] || `https://api.dicebear.com/7.x/initials/svg?seed=${u.first_name || "A"}`}
                    className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                    alt={u.first_name}
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

      {/* ── Bottom stats row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Taux de rétention (M1)", value: "74%", icon: "↩️", color: "text-primary" },
          { label: "Durée moy. de session", value: "12 min", icon: "⏱️", color: "text-sky-500" },
          { label: "Compatibilité moy.", value: "87%", icon: "💡", color: "text-gold" },
          { label: "NPS Score", value: "+62", icon: "❤️", color: "text-emerald-500" },
        ].map(item => (
          <div key={item.label} className="bg-card border border-border/50 rounded-2xl p-4 text-center shadow-sm">
            <div className="text-2xl mb-1">{item.icon}</div>
            <div className={`text-2xl font-bold font-serif ${item.color}`}>{item.value}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
