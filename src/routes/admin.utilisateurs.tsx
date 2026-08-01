import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, CheckCircle2, Trash2, Shield, Eye, MoreVertical, Ban, Crown, User, Filter, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/utilisateurs")({
  component: AdminUtilisateurs,
});

type UserRow = {
  id: string;
  first_name: string;
  email?: string;
  city: string;
  country: string;
  gender: string;
  is_verified: boolean;
  created_at: string;
  photos: string[];
  bio?: string;
  denomination?: string;
};

function AdminUtilisateurs() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "unverified">("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");

  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    premium: 1840, // Mock for now
    vip: 350, // Mock for now
    pending: 0,
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data, error, count } = await supabase
          .from("profiles")
          .select("id, first_name, city, country, gender, is_verified, created_at, photos, bio, denomination", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(100);
        
        if (error) throw error;
        
        const loadedUsers = (data as UserRow[]) || [];
        setUsers(loadedUsers);

        const verifiedCount = loadedUsers.filter(u => u.is_verified).length;
        const unverifiedCount = loadedUsers.filter(u => !u.is_verified).length;

        setStats({
          total: count || loadedUsers.length,
          verified: verifiedCount,
          premium: Math.floor((count || loadedUsers.length) * 0.15), // Mock 15% premium
          pending: unverifiedCount,
        });

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const filtered = users.filter(u => {
    const matchSearch = u.first_name?.toLowerCase().includes(search.toLowerCase()) ||
                        u.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" ? true :
                        statusFilter === "verified" ? u.is_verified :
                        !u.is_verified;
    const matchGender = genderFilter === "all" ? true : u.gender === genderFilter;
    
    return matchSearch && matchStatus && matchGender;
  });

  const verifyUser = async (id: string) => {
    await supabase.from("profiles").update({ is_verified: true }).eq("id", id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_verified: true } : u));
    setStats(s => ({ ...s, verified: s.verified + 1, pending: s.pending - 1 }));
    toast.success("Profil certifié avec succès ✓");
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement le profil de ${name} ?`)) return;
    await supabase.from("profiles").delete().eq("id", id);
    setUsers(prev => prev.filter(u => u.id !== id));
    toast.success("Profil supprimé");
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Gestion des Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">Gérez, vérifiez et modérez tous les membres de la plateforme.</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
          <User className="w-4 h-4" /> Ajouter manuellement
        </button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-serif">{loading ? "—" : stats.total}</div>
            <div className="text-xs text-muted-foreground">Membres inscrits</div>
          </div>
        </div>
        <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-serif">{loading ? "—" : stats.verified}</div>
            <div className="text-xs text-muted-foreground">Profils vérifiés</div>
          </div>
        </div>
        <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-serif">{loading ? "—" : stats.pending}</div>
            <div className="text-xs text-muted-foreground">En attente de vérif.</div>
          </div>
        </div>
        <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gold/10 text-gold flex items-center justify-center shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-serif">{loading ? "—" : stats.premium}</div>
            <div className="text-xs text-muted-foreground">Abonnés Premium</div>
          </div>
        </div>
        <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-serif">{loading ? "—" : stats.vip}</div>
            <div className="text-xs text-muted-foreground">Offres VIP</div>
          </div>
        </div>
      </div>

      {/* ── Toolbar (Search & Filters) ─────────────────────────────────────── */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par prénom, ville..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
          />
        </div>
        
        <div className="flex w-full md:w-auto gap-3 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-2 bg-secondary/50 rounded-xl p-1 border border-border/50 shrink-0">
            {(["all", "verified", "unverified"] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Tous statuts" : f === "verified" ? "Vérifiés" : "Non vérifiés"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-secondary/50 rounded-xl p-1 border border-border/50 shrink-0">
            {(["all", "female", "male"] as const).map(f => (
              <button
                key={f}
                onClick={() => setGenderFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  genderFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Tous genres" : f === "female" ? "Femmes" : "Hommes"}
              </button>
            ))}
          </div>
          
          <button className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-secondary transition-colors shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Plus de filtres
          </button>
        </div>
      </div>

      {/* ── Enhanced Table ─────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/40 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 rounded-tl-2xl">
                  <div className="flex items-center gap-2 cursor-pointer hover:text-foreground">Membre <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4">Informations</th>
                <th className="px-6 py-4">Statut & Plan</th>
                <th className="px-6 py-4">Activité (Mock)</th>
                <th className="px-6 py-4 text-right rounded-tr-2xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="px-6 py-5"><div className="h-5 bg-secondary animate-pulse rounded-md" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Filter className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-base font-medium">Aucun utilisateur trouvé</p>
                      <p className="text-xs mt-1">Essayez de modifier vos critères de recherche.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((user, i) => {
                  // Mocks for display richness
                  const isPremiumPlan = i % 7 === 0;
                  const isAgape = !isPremiumPlan && i % 5 === 0;
                  const isPremium = isPremiumPlan || isAgape;
                  const matchCount = Math.floor(Math.random() * 50);
                  const reportCount = i % 15 === 0 ? 1 : 0;

                  return (
                    <tr key={user.id} className="hover:bg-secondary/20 transition-colors group">
                      {/* 1. Profile Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <img
                              src={user.photos?.[0] || `https://api.dicebear.com/7.x/initials/svg?seed=${user.first_name}`}
                              alt={user.first_name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-background shadow-sm"
                            />
                            {user.is_verified && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-base flex items-center gap-1.5">
                              {user.first_name || "Anonyme"}
                              {isPremium && <Crown className="w-3.5 h-3.5 text-gold" />}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 max-w-[150px] truncate">
                              ID: {user.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Demographics & Bio */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="font-medium text-foreground">{user.city || "Ville inconnue"}</span>
                            {user.country && <span className="text-muted-foreground">, {user.country}</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">{user.gender === "female" ? "Femme" : user.gender === "male" ? "Homme" : "—"}</span>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{user.denomination || "Chrétien(ne)"}</span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Status & Plan */}
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div>
                            {user.is_verified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Vérifié
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-semibold border border-amber-500/20">
                                En attente
                              </span>
                            )}
                          </div>
                          <div>
                            {isPremium ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gold/10 text-gold text-[10px] font-bold uppercase tracking-wider">
                                <Crown className="w-3 h-3" /> Premium
                              </span>
                            ) : isAgape ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                <Crown className="w-3 h-3" /> VIP
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                                Gratuit
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Activity */}
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between items-center w-24">
                            <span className="text-muted-foreground">Inscrit:</span>
                            <span className="font-medium">{user.created_at ? formatDate(user.created_at) : "—"}</span>
                          </div>
                          <div className="flex justify-between items-center w-24">
                            <span className="text-muted-foreground">Matchs:</span>
                            <span className="font-medium">{matchCount}</span>
                          </div>
                          {reportCount > 0 && (
                            <div className="flex justify-between items-center w-24 text-destructive font-medium">
                              <span>Signalé:</span>
                              <span>{reportCount} fois</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 5. Actions */}
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 rounded-xl hover:bg-secondary text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40">
                              <MoreVertical className="w-5 h-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-elegant border-border/50 p-1">
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Actions sur le profil</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="cursor-pointer gap-2 py-2 rounded-lg">
                              <Eye className="w-4 h-4 text-muted-foreground" /> Voir les détails
                            </DropdownMenuItem>
                            {!user.is_verified && (
                              <DropdownMenuItem onClick={() => verifyUser(user.id)} className="cursor-pointer gap-2 py-2 rounded-lg text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" /> Certifier le profil
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="cursor-pointer gap-2 py-2 rounded-lg text-amber-600 focus:bg-amber-500/10 focus:text-amber-600">
                              <Ban className="w-4 h-4" /> Suspendre
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deleteUser(user.id, user.first_name)} className="cursor-pointer gap-2 py-2 rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive">
                              <Trash2 className="w-4 h-4" /> Supprimer définitivement
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination mock */}
        <div className="px-6 py-4 border-t border-border/50 bg-secondary/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Affichage de 1 à {filtered.length} sur {stats.total} utilisateurs</span>
          <div className="flex gap-1">
            <button className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary disabled:opacity-50" disabled>Précédent</button>
            <button className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary disabled:opacity-50">Suivant</button>
          </div>
        </div>
      </div>
    </div>
  );
}
