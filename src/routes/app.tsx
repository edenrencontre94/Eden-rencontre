import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/app/BottomNav";
import { Bell, Crown, User } from "lucide-react";
import { SubscriptionProvider } from "@/lib/subscription";
import logo from "@/assets/logo.jpg";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Settings, Languages, Package, CreditCard, Ban, Trash2, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  // No beforeLoad — auth is checked client-side only to avoid SSR logout on refresh
  component: AppLayout,
});

function AppLayout() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // This only runs in the browser, after hydration.
    // It reads the Supabase session from localStorage — the correct way.
    let cancelled = false;
    async function checkAuth() {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          navigate({ to: "/login", replace: true });
        } else {
          setAuthed(true);
          setAuthChecked(true);
          // Fetch user avatar
          supabase
            .from("profiles")
            .select("photos")
            .eq("id", session.user.id)
            .single()
            .then(({ data }) => {
              if (data && data.photos && data.photos.length > 0) {
                setAvatarUrl(data.photos[0]);
              }
            });
        }
      } catch {
        if (!cancelled) navigate({ to: "/login", replace: true });
      }
    }
    checkAuth();

    // Also listen for auth state changes (logout from another tab, token expiry)
    let unsub: (() => void) | undefined;
    import("@/lib/supabase").then(({ supabase }) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if (!session) {
          navigate({ to: "/login", replace: true });
        } else {
          setAuthed(true);
          setAuthChecked(true);
        }
      });
      unsub = () => subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [navigate]);

  // Show nothing while checking — prevents flash of protected content
  if (!authChecked || !authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="AgapeMeet" className="w-12 h-12 object-contain animate-pulse" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <SubscriptionProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="AgapeMeet" className="w-9 h-9 object-contain" />
              <span className="font-serif text-lg font-semibold">AgapeMeet</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/app/abonnement"
                aria-label="Abonnement"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-gold text-gold-foreground text-xs font-semibold shadow-soft"
              >
                <Crown className="w-3.5 h-3.5" /> Alliance
              </Link>
              <button
                aria-label="Notifications"
                className="relative w-9 h-9 rounded-full border border-border bg-background hover:bg-secondary flex items-center justify-center"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
              </button>
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    aria-label="Menu"
                    className="w-9 h-9 rounded-full border border-border bg-background hover:bg-secondary flex items-center justify-center overflow-hidden transition-transform hover:scale-105"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] max-w-sm sm:max-w-md bg-secondary/30 p-0 border-l border-border/50">
                  <div className="h-full bg-background/50 backdrop-blur-xl flex flex-col pt-12 pb-6 px-4 gap-2">
                    <Link
                      to="/app/profil"
                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/5 transition-colors group"
                    >
                      <User className="w-6 h-6 text-foreground/80 group-hover:text-primary transition-colors" />
                      <span className="text-base font-medium group-hover:text-primary transition-colors">Mon profil</span>
                    </Link>
                    <button
                      onClick={() => toast.info("Bientôt disponible")}
                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary transition-colors"
                    >
                      <Camera className="w-6 h-6 text-foreground/80" />
                      <span className="text-base font-medium">Mes photos</span>
                    </button>
                    <button
                      onClick={() => toast.info("Bientôt disponible")}
                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary transition-colors"
                    >
                      <Settings className="w-6 h-6 text-foreground/80" />
                      <span className="text-base font-medium">Paramètres de sécurité</span>
                    </button>
                    <button
                      onClick={() => toast.info("Bientôt disponible")}
                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary transition-colors"
                    >
                      <Bell className="w-6 h-6 text-foreground/80" />
                      <span className="text-base font-medium">Paramètres de notification</span>
                    </button>
                    <button
                      onClick={() => toast.info("Bientôt disponible")}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-background shadow-sm hover:bg-secondary transition-colors"
                    >
                      <Languages className="w-6 h-6 text-primary" />
                      <span className="text-base font-medium text-primary">Paramètres de la langue</span>
                    </button>
                    <Link
                      to="/app/abonnement"
                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary transition-colors"
                    >
                      <Package className="w-6 h-6 text-foreground/80" />
                      <span className="text-base font-medium">Abonnement</span>
                    </Link>
                    <button
                      onClick={() => toast.info("Bientôt disponible")}
                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary transition-colors"
                    >
                      <CreditCard className="w-6 h-6 text-foreground/80" />
                      <span className="text-base font-medium">Facturation</span>
                    </button>
                    <button
                      onClick={() => toast.info("Bientôt disponible")}
                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary transition-colors"
                    >
                      <Ban className="w-6 h-6 text-foreground/80" />
                      <span className="text-base font-medium">Profils bloqués</span>
                    </button>
                    
                    <div className="mt-auto pt-4 border-t border-border/50">
                      <button
                        onClick={() => toast.info("Bientôt disponible")}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-destructive/10 text-foreground/80 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-6 h-6" />
                        <span className="text-base font-medium">Supprimer le compte</span>
                      </button>
                      <button
                        onClick={async () => {
                          await supabase.auth.signOut();
                          navigate({ to: "/login" });
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary transition-colors"
                      >
                        <LogOut className="w-6 h-6 text-foreground/80" />
                        <span className="text-base font-medium">Déconnexion</span>
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>
        <main className="max-w-2xl mx-auto pb-28">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </SubscriptionProvider>
  );
}