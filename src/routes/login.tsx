import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import logoAsset from "@/assets/logo.png";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Connexion — Eden Rencontre" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !email.trim().includes("@")) {
      toast.error(t("login.err_email"));
      return;
    }
    if (!password) {
      toast.error(t("login.err_password"));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;
      if (data.session) {
        toast.success(t("login.welcome_back"));
        
        // Petite pause pour s'assurer que la session locale est bien enregistrée
        setTimeout(() => {
          window.location.replace("/admin");
        }, 500);
      }
    } catch (err: any) {
      if (err.message.includes("Invalid login credentials")) {
        toast.error(t("login.err_credentials"));
      } else {
        toast.error(t("login.err_prefix") + err.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border/40 shadow-elegant rounded-3xl p-8 relative overflow-hidden">
        {/* Cercles de fond pour le style */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/50 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <Link to="/" className="inline-block hover:scale-105 transition-transform">
            <img src={logoAsset} alt="Eden Rencontre" className="w-16 h-16 object-contain" />
          </Link>
          <h1 className="font-serif text-3xl font-bold mt-6 mb-2">{t("login.title")}</h1>
          <p className="text-muted-foreground text-center mb-8">
            {t("login.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {t("login.email")}
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="h-12 bg-background/50 focus:bg-background transition-colors text-base rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-muted-foreground" />
                {t("login.password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.password_placeholder")}
                  className="h-12 pr-11 bg-background/50 focus:bg-background transition-colors text-base rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-elegant rounded-xl mt-4"
            >
              {loading ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>

          <p className="mt-8 text-sm text-muted-foreground">
            {t("login.no_account")}{" "}
            <Link to="/inscription" className="text-primary hover:underline font-medium">
              {t("login.sign_up")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
