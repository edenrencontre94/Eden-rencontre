import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/logo.jpg";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      throw redirect({ to: "/app" });
    }
  },
  head: () => ({
    meta: [
      { title: "Se connecter — AgapeMeet" },
      { name: "description", content: "Connectez-vous a votre compte AgapeMeet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim().includes("@") || password.length < 6) {
      toast.error("Veuillez remplir tous les champs correctement.");
      return;
    }
    setLoading(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Connexion reussie ! Bienvenue");
      window.location.href = "/app";
    } catch (err: any) {
      toast.error("Identifiants incorrects. Veuillez reessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/80 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoAsset} alt="AgapeMeet" className="w-10 h-10 object-contain" />
            <span className="font-serif text-xl font-semibold">AgapeMeet</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="bg-card rounded-3xl shadow-elegant border border-border/50 p-8 sm:p-10">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-elegant">
                <Heart className="w-7 h-7 text-primary-foreground" fill="currentColor" />
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Content de vous revoir</h1>
              <p className="text-muted-foreground mt-2 text-sm">Connectez-vous a votre compte AgapeMeet</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Adresse email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); toast.info("Fonctionnalite bientot disponible"); }}
                    className="text-xs text-primary hover:opacity-80 transition"
                  >
                    Mot de passe oublie ?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="..."
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full gap-2 bg-gradient-to-r from-primary to-primary/85 hover:opacity-95 shadow-elegant font-semibold"
                >
                  {loading ? "Connexion..." : "Se connecter"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </Button>
              </motion.div>
            </form>

            <div className="mt-6 pt-6 border-t border-border/50 text-center">
              <p className="text-sm text-muted-foreground">
                Pas encore de compte ?{" "}
                <Link to="/onboarding" className="text-primary font-semibold hover:opacity-80 transition">
                  Creer mon compte
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
