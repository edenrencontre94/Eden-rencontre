import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, CheckCircle2, ShieldBan, Trash2, Eye, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/utilisateurs")({
  component: AdminUtilisateurs,
});

type UserRow = {
  id: string;
  first_name: string;
  email?: string;
  city: string;
  gender: string;
  is_verified: boolean;
  created_at: string;
  photos: string[];
};

function AdminUtilisateurs() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all");

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, city, gender, is_verified, created_at, photos")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        setUsers((data as UserRow[]) || []);
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
    const matchFilter = filter === "all" ? true :
                        filter === "verified" ? u.is_verified :
                        !u.is_verified;
    return matchSearch && matchFilter;
  });

  const verifyUser = async (id: string) => {
    await supabase.from("profiles").update({ is_verified: true }).eq("id", id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_verified: true } : u));
    toast.success("Profil vérifié ✓");
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Supprimer ce profil ?")) return;
    await supabase.from("profiles").delete().eq("id", id);
    setUsers(prev => prev.filter(u => u.id !== id));
    toast.success("Profil supprimé");
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold">Utilisateurs</h1>
        <p className="text-muted-foreground mt-1">{users.length} membres inscrits au total.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par prénom ou ville…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "verified", "unverified"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {f === "all" ? "Tous" : f === "verified" ? "Vérifiés" : "Non vérifiés"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-secondary/30">
              <tr>
                <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membre</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Genre</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ville</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inscription</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
                <th className="text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-secondary animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Aucun utilisateur trouvé.</td></tr>
              ) : (
                filtered.map(user => (
                  <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.photos?.[0] || `https://api.dicebear.com/7.x/initials/svg?seed=${user.first_name}`}
                          alt={user.first_name}
                          className="w-9 h-9 rounded-full object-cover border border-border"
                        />
                        <span className="font-medium">{user.first_name || "Anonyme"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground capitalize">{user.gender || "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{user.city || "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{user.created_at ? formatDate(user.created_at) : "—"}</td>
                    <td className="px-6 py-4">
                      {user.is_verified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Vérifié
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-semibold">
                          En attente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!user.is_verified && (
                          <button onClick={() => verifyUser(user.id)} className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-600 transition-colors" title="Vérifier">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => deleteUser(user.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
