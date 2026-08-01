import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Ban, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/accueil/parametres/bloques")({
  head: () => ({
    meta: [{ title: "Profils bloqués — AgapeMeet" }],
  }),
  component: BlockedProfilesPage,
});

function BlockedProfilesPage() {
  // En attendant d'avoir une table 'blocks'
  const [blocked, setBlocked] = useState<any[]>([]);

  const handleUnblock = (id: string) => {
    toast.success("Profil débloqué");
    setBlocked(blocked.filter(b => b.id !== id));
  };

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
                <img src={user.photo} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
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
