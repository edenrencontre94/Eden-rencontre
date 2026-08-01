import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/parametres/securite")({
  head: () => ({
    meta: [{ title: "Sécurité — AgapeMeet" }],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      toast.success("Mot de passe mis à jour avec succès");
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour du mot de passe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/accueil" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold">Sécurité</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-6 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm text-center text-muted-foreground px-4">
          Gérez vos paramètres de sécurité et vos identifiants de connexion.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-border/50 rounded-3xl p-5 sm:p-6 shadow-soft">
          <div className="flex items-center gap-3 mb-4">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-lg font-medium">Changer le mot de passe</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Nouveau mot de passe</label>
              <Input 
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            
            <button
              onClick={handleUpdatePassword}
              disabled={loading || !newPassword}
              className="w-full h-11 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </button>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-3xl p-5 sm:p-6 shadow-soft">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-serif text-lg font-medium text-muted-foreground">Changer l'email</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Pour modifier l'adresse email associée à votre compte, veuillez contacter le support client.
          </p>
          <a
            href="mailto:contact@agapemeet.com"
            className="w-full h-11 flex items-center justify-center bg-secondary text-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors"
          >
            Contacter le support
          </a>
        </div>
      </div>
    </div>
  );
}
