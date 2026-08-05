import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/logo.png";

export const Route = createFileRoute("/nouveau-mot-de-passe")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — AgapeMeet" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewPasswordPage,
});

function NewPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const navigate = useNavigate();

  /**
   * En arrivant depuis le lien reçu par e-mail, Supabase place un jeton de
   * récupération dans l'URL et ouvre une session temporaire. Sans elle,
   * `updateUser` échouerait — on vérifie donc avant d'afficher le formulaire,
   * plutôt que de laisser l'utilisateur saisir un mot de passe pour rien.
   */
  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    supabase.auth.getSession().then(({ data }: any) => {
      if (!cancelled) setReady(Boolean(data.session));
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      console.error("[nouveau mot de passe]", error);
      toast.error(
        error.message?.toLowerCase().includes("same")
          ? "Choisissez un mot de passe différent de l'ancien"
          : "Le mot de passe n'a pas pu être modifié. Le lien a peut-être expiré.",
      );
      return;
    }

    toast.success("Mot de passe modifié — vous êtes connecté");
    navigate({ to: "/accueil" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-soft/30 to-background flex items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-card border border-border/60 rounded-3xl p-7 shadow-elegant">
          <div className="flex flex-col items-center text-center">
            <img src={logoAsset} alt="AgapeMeet" className="w-12 h-12 object-contain" />

            {ready === false ? (
              <>
                <h1 className="font-serif text-2xl font-semibold mt-4">Lien invalide ou expiré</h1>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Ce lien de réinitialisation n'est plus valable. Les liens expirent au bout
                  d'une heure, et ne peuvent servir qu'une fois.
                </p>
                <a
                  href="/mot-de-passe-oublie"
                  className="mt-5 inline-flex px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                >
                  Demander un nouveau lien
                </a>
              </>
            ) : ready === null ? (
              <div className="py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              </div>
            ) : (
              <>
                <h1 className="font-serif text-2xl font-semibold mt-4">Nouveau mot de passe</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Choisissez un mot de passe que vous n'utilisez nulle part ailleurs.
                </p>

                <form onSubmit={submit} className="w-full mt-6 space-y-4 text-left">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">Nouveau mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="8 caractères minimum"
                        className="pl-9 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShow(!show)}
                        aria-label={show ? "Masquer" : "Afficher"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirmer</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Ressaisissez-le"
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
                      <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</>
                    ) : (
                      "Changer mon mot de passe"
                    )}
                  </button>
                </form>

                <p className="text-[11px] text-muted-foreground mt-4 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Vous serez connecté automatiquement après la modification.
                </p>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
