import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, CheckCircle2, Trash2, Shield, MoreVertical, Crown, User,
  Filter, Gem, Users, AlertTriangle, RefreshCw, Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/plans";
import { displayName } from "@/lib/utils";

export const Route = createFileRoute("/admin/utilisateurs")({
  component: AdminUtilisateurs,
});

/**
 * Membres, répartis par offre.
 *
 * Cette page affichait des effectifs INVENTÉS — `premium: 1840`,
 * `vip: 350`, puis `Math.floor(total * 0.15)` — et attribuait les badges
 * au hasard : `i % 7 === 0` pour Premium, `i % 5 === 0` pour VIP. Le
 * nombre de matchs venait d'un `Math.random()`, et une colonne était
 * honnêtement intitulée « Activité (Mock) ».
 *
 * Un tableau de bord qui invente est pire qu'un tableau de bord vide : on
 * prend des décisions dessus. Tout vient désormais de la base.
 */

type UserRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  city: string | null;
  country: string | null;
  gender: string | null;
  is_verified: boolean;
  is_founder: boolean;
  public_plan: string;
  premium_until: string | null;
  created_at: string;
  last_seen: string | null;
  photos: string[] | null;
  denomination: string | null;
  total_paye: number;
  nb_paiements: number;
  total_count: number;
};

type Counts = {
  total: number; gratuit: number; premium: number; vip: number;
  fondateurs: number; expires: number; verifies: number; non_verifies: number;
};

const PLANS = [
  { key: "all", label: "Tous", icon: Users },
  { key: "gratuit", label: "Gratuit", icon: User },
  { key: "premium", label: "Premium", icon: Crown },
  { key: "vip", label: "VIP", icon: Gem },
] as const;

const PAGE_SIZE = 50;

function AdminUtilisateurs() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [plan, setPlan] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const [{ data: c }, { data: rows, error: err }] = await Promise.all([
      supabase.rpc("admin_plan_counts"),
      supabase.rpc("admin_users_by_plan", {
        p_plan: plan,
        p_search: search.trim() || null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      }),
    ]);

    if (err || (c as any)?.error) {
      console.error("[admin/utilisateurs]", err ?? c);
      setError("Lecture impossible. La migration 43 a-t-elle été exécutée ?");
      setLoading(false);
      return;
    }

    setCounts(c as Counts);
    setUsers((rows ?? []) as UserRow[]);
    setLoading(false);
  };

  // La recherche est temporisée : sans cela, chaque frappe déclencherait
  // une requête et la liste sauterait à chaque lettre.
  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [plan, search, page]);

  // Changer d'onglet ou de recherche remet à la première page : rester en
  // page 4 d'un filtre qui n'en compte qu'une afficherait un vide trompeur.
  useEffect(() => { setPage(0); }, [plan, search]);

  const total = Number(users[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const verifyUser = async (id: string) => {
    const { error: err } = await supabase.from("profiles").update({ is_verified: true }).eq("id", id);
    if (err) { toast.error("La certification a échoué"); return; }
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, is_verified: true } : u)));
    setCounts(c => (c ? { ...c, verifies: c.verifies + 1, non_verifies: c.non_verifies - 1 } : c));
    toast.success("Profil certifié");
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Supprimer définitivement le profil de ${name} ? Ses messages, matchs et publications disparaîtront avec lui.`)) return;
    const { error: err } = await supabase.from("profiles").delete().eq("id", id);
    if (err) { toast.error("La suppression a échoué"); return; }
    setUsers(prev => prev.filter(u => u.id !== id));
    toast.success("Profil supprimé");
  };

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const activity = (d?: string | null) => {
    if (!d) return "Jamais vu";
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 30) return `Il y a ${days} j`;
    return `Il y a ${Math.floor(days / 30)} mois`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Répartition réelle par offre, effectifs et paiements.
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm hover:bg-secondary transition-colors"
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

      {/* ── Effectifs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Membres inscrits" value={counts?.total} />
        <Kpi
          icon={User} label="Formule Gratuite" value={counts?.gratuit}
          hint={counts && counts.total > 0
            ? `${Math.round((counts.gratuit / counts.total) * 100)} % du total`
            : undefined}
        />
        <Kpi icon={Crown} label="Abonnés Premium" value={counts?.premium} tone="primary" />
        <Kpi
          icon={Gem} label="Membres VIP" value={counts?.vip} tone="gold"
          hint={counts && counts.fondateurs > 0
            ? `dont ${counts.fondateurs} fondateur(s)`
            : undefined}
        />
      </div>

      {/* Les anciens abonnés sont la cible de relance la plus rentable :
          ils ont déjà franchi le pas du paiement une fois. */}
      {counts && counts.expires > 0 && (
        <div className="rounded-2xl border border-gold/50 bg-gold/5 p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">
            <strong>{counts.expires}</strong> membre(s) ont eu un abonnement aujourd'hui
            expiré. Ils ont déjà payé une fois — c'est l'audience la plus susceptible
            de renouveler.
          </p>
        </div>
      )}

      {/* ── Onglets par offre ─────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {PLANS.map(p => {
          const n = !counts ? null
            : p.key === "all" ? counts.total
            : p.key === "gratuit" ? counts.gratuit
            : p.key === "premium" ? counts.premium
            : counts.vip;
          return (
            <button
              key={p.key}
              onClick={() => setPlan(p.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                plan === p.key
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <p.icon className="w-4 h-4" />
              {p.label}
              {n !== null && <span className="opacity-75">({n})</span>}
            </button>
          );
        })}
      </div>

      {/* ── Recherche ─────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher par prénom, nom, ville ou pays…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* ── Tableau ───────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[820px]">
            <thead className="bg-secondary/40 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Membre</th>
                <th className="px-6 py-4">Localisation</th>
                <th className="px-6 py-4">Offre</th>
                <th className="px-6 py-4">Paiements</th>
                <th className="px-6 py-4">Activité</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-6 py-5"><div className="h-5 bg-secondary animate-pulse rounded-md" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Filter className="w-10 h-10 mb-3 opacity-20 mx-auto" />
                    <p className="text-base font-medium">Aucun membre</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {search
                        ? "Aucun résultat pour cette recherche."
                        : "Cette offre ne compte aucun membre."}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={u.photos?.[0] || `https://api.dicebear.com/7.x/initials/svg?seed=${u.first_name}`}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover border-2 border-background shadow-sm"
                          />
                          {u.is_verified && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {displayName(u.first_name, u.last_name)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Inscrit le {fmtDate(u.created_at)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm">{u.city || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {u.country || "Pays non précisé"}
                        {u.gender && ` · ${u.gender === "female" ? "Femme" : "Homme"}`}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <PlanCell user={u} />
                    </td>

                    <td className="px-6 py-4">
                      {u.nb_paiements > 0 ? (
                        <>
                          <div className="font-semibold tabular-nums">{formatPrice(u.total_paye)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {u.nb_paiements} paiement{u.nb_paiements > 1 ? "s" : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Jamais payé</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm">{activity(u.last_seen)}</div>
                      {!u.is_verified && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-semibold">
                          <Shield className="w-3 h-3" /> À vérifier
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 rounded-xl hover:bg-secondary text-muted-foreground transition-colors">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Actions sur le profil
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {!u.is_verified && (
                            <DropdownMenuItem
                              onClick={() => verifyUser(u.id)}
                              className="cursor-pointer gap-2 py-2 rounded-lg text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Certifier le profil
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => deleteUser(u.id, u.first_name)}
                            className="cursor-pointer gap-2 py-2 rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" /> Supprimer définitivement
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination réelle : elle affichait « Précédent / Suivant »
            désactivés, sur un total inventé. */}
        <div className="px-6 py-4 border-t border-border/50 bg-secondary/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {total > 0
              ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} sur ${total}`
              : "Aucun résultat"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary disabled:opacity-40"
            >
              Précédent
            </button>
            <span>Page {page + 1} / {pages}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page + 1 >= pages}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Offre du membre, avec son échéance.
 *
 * Un badge sans date ne dit pas si l'abonnement court encore. La
 * distinction est donc explicite : « expiré le… » plutôt qu'un badge muet.
 */
function PlanCell({ user }: { user: UserRow }) {
  const actif = user.premium_until ? new Date(user.premium_until).getTime() > Date.now() : false;

  if (user.is_founder) {
    return (
      <div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/30 text-[10px] font-bold">
          <Gem className="w-3 h-3" /> VIP
        </span>
        <div className="text-[11px] text-muted-foreground mt-1">Membre fondateur · à vie</div>
      </div>
    );
  }

  if (!actif) {
    return (
      <div>
        <span className="text-xs text-muted-foreground">Gratuit</span>
        {user.premium_until && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Expiré le {new Date(user.premium_until).toLocaleDateString("fr-FR")}
          </div>
        )}
      </div>
    );
  }

  const vip = user.public_plan === "vip";
  return (
    <div>
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
        vip ? "bg-gold/20 text-gold border-gold/30" : "bg-primary/15 text-primary border-primary/25"
      }`}>
        {vip ? <Gem className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
        {vip ? "VIP" : "Premium"}
      </span>
      <div className="text-[11px] text-muted-foreground mt-1">
        Jusqu'au {new Date(user.premium_until!).toLocaleDateString("fr-FR")}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }: {
  icon: any; label: string; value?: number; hint?: string; tone?: "primary" | "gold";
}) {
  const cls = tone === "gold" ? "bg-gold/10 text-gold"
    : tone === "primary" ? "bg-primary/10 text-primary"
    : "bg-secondary text-muted-foreground";
  return (
    <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${cls}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold font-serif">{value ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
