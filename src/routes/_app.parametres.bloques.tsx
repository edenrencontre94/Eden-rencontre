import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { unblockUser } from "@/lib/moderation";

export const Route = createFileRoute("/_app/parametres/bloques")({
  head: () => ({
    meta: [{ title: "Profils bloqués — AgapeMeet" }],
  }),
  component: BlockedProfilesPage,
});

type BlockedProfile = { id: string; name: string; photo: string | null };

function BlockedProfilesPage() {
  const [blocked, setBlocked] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: rows, error } = await supabase
          .from("blocks")
          .select("blocked_id")
          .eq("blocker_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("[bloqués] chargement:", error);
          return;
        }
        if (!rows || rows.length === 0) return;

        const ids = rows.map((r: any) => r.blocked_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, photos")
          .in("id", ids);

        setBlocked(
          (profiles ?? []).map((p: any) => ({
            id: p.id,
            name: p.first_name || "Membre",
            photo: p.photos?.[0] ?? null,
          })),
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleUnblock = async (id: string) => {
    const previous = blocked;
    setBlocked(blocked.filter(b => b.id !== id));

    const ok = await unblockUser(id);
    if (ok) {
      toast.success("Profil débloqué");
    } else {
      setBlocked(previous); // rétablir la liste si l'écriture a échoué
      toast.error("Le déblocage n'a pas pu être enregistré");
    }
  };

  if (loading) {
    return (
      <div className="px-4 pt-4 pb-12 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-secondary animate-pulse" />
          <div className="h-7 w-48 rounded bg-secondary animate-pulse" />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/accueil" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold">Profils bloqués</h1>
      </div>

      {blocked.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
            <ShieldCheck className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-medium mb-2">Aucun profil bloqué</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Les personnes que vous bloquez n'apparaîtront plus dans vos découvertes et ne pourront plus vous contacter.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-3xl p-3 shadow-soft space-y-2">
          {blocked.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                {user.photo ? (
                  <img src={user.photo} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/25 to-gold/25 flex items-center justify-center font-serif font-semibold text-primary">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium">{user.name}</span>
              </div>
              <button 
                onClick={() => handleUnblock(user.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-background border border-border hover:bg-secondary transition-colors"
              >
                Débloquer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
