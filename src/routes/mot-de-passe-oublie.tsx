import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/logo.png";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — AgapeMeet" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
    });
    setLoading(false);

    if (error) {
      console.error("[mot de passe oublié]", error);
      // On n'affiche PAS « cette adresse n'existe pas » : cela permettrait
      // à n'importe qui de découvrir quelles adresses sont inscrites.
      // Seules les erreurs techniques sont signalées.
      if (error.message?.toLowerCase().includes("rate")) {
        toast.error("Trop de tentatives. Réessayez dans quelques minutes.");
        return;
      }
    }

    // Même écran que l'adresse existe ou non — c'est volontaire.
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-soft/30 to-background flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour à la connexion
        </Link>

        <div className="bg-card border border-border/60 rounded-3xl p-7 shadow-elegant">
          <div className="flex flex-col items-center text-center">
            <img src={logoAsset} alt="AgapeMeet" className="w-12 h-12 object-contain" />

            {sent ? (
              <>
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mt-4">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <h1 className="font-serif text-2xl font-semibold mt-4">Vérifiez votre boîte mail</h1>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Si un compte existe avec l'adresse <strong className="text-foreground">{email}</strong>,
                  vous recevrez un lien pour choisir un nouveau mot de passe.
                </p>
                <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                  Le lien est valable une heure. Pensez à regarder dans vos courriers
                  indésirables si rien n'apparaît d'ici quelques minutes.
                </p>
                <button
                  onClick={() => { setSent(false); setEmail(""); }}
                  className="mt-5 text-sm text-primary font-medium hover:underline"
                >
                  Essayer une autre adresse
                </button>
              </>
            ) : (
              <>
                <h1 className="font-serif text-2xl font-semibold mt-4">Mot de passe oublié</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Indiquez votre adresse e-mail, nous vous enverrons un lien de réinitialisation.
                </p>

                <form onSubmit={submit} className="w-full mt-6 space-y-4 text-left">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email">Adresse e-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="votre@email.com"
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-elegant disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
                    ) : (
                      "Envoyer le lien"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Pas encore de compte ?{" "}
          <Link to="/inscription" className="text-primary font-medium hover:underline">
            Créer un compte
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
