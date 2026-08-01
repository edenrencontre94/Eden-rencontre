import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/app/BottomNav";
import { Bell, Crown, User } from "lucide-react";
import { SubscriptionProvider } from "@/lib/subscription";
import logo from "@/assets/logo.png";
import { useEffect, useState } from "react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Settings, Languages, Package, CreditCard, Ban, Trash2, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app")({
  // No beforeLoad — auth is checked client-side only to avoid SSR logout on refresh
  component: AppLayout,
});

function AppLayout() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "SUPPRIMER") {
      toast.error("Veuillez taper SUPPRIMER pour confirmer.");
      return;
    }
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Optionnel : Vous pouvez appeler une fonction RPC Supabase ici 
        // pour supprimer les données associées ou le compte auth.
        // ex: await supabase.rpc('delete_user_data');
        await supabase.from('profiles').delete().eq('id', user.id);
      }
      await supabase.auth.signOut();
      navigate({ to: "/login" });
      toast.success("Compte supprimé avec succès.");
    } catch (e) {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

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
            .then(({ data }: any) => {
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
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
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
                to="/abonnement"
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
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
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-elegant border-border/50 bg-background/95 backdrop-blur-xl p-2 mt-2">
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Mon Compte
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/50" />
                  
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer hover:bg-primary/10">
                    <Link to="/profil" className="flex items-center gap-3 py-2.5 px-2">
                      <User className="w-4 h-4" />
                      <span className="font-medium">Mon profil</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer hover:bg-secondary">
                    <Link to="/abonnement" className="flex items-center gap-3 py-2.5 px-2">
                      <Crown className="w-4 h-4 text-gold" />
                      <span className="font-medium">Abonnement & Facturation</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-border/50 mt-2 mb-2" />
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Paramètres
                  </DropdownMenuLabel>
                  
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer hover:bg-secondary">
                    <Link to="/parametres/securite" className="flex items-center gap-3 py-2.5 px-2">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Sécurité</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer hover:bg-secondary">
                    <Link to="/parametres/notifications" className="flex items-center gap-3 py-2.5 px-2">
                      <Bell className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Notifications</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer hover:bg-secondary">
                    <Link to="/parametres/langue" className="flex items-center gap-3 py-2.5 px-2">
                      <Languages className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Langue</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer hover:bg-secondary">
                    <Link to="/parametres/bloques" className="flex items-center gap-3 py-2.5 px-2">
                      <Ban className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Profils bloqués</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-border/50 mt-2 mb-2" />
                  
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault(); // Prevent dropdown from closing immediately which breaks dialog focus
                      setIsDeleteDialogOpen(true);
                    }}
                    className="rounded-xl cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <div className="flex items-center gap-3 py-2.5 px-2 w-full">
                      <Trash2 className="w-4 h-4" />
                      <span className="font-medium">Supprimer le compte</span>
                    </div>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onSelect={async () => {
                      await supabase.auth.signOut();
                      navigate({ to: "/login" });
                    }}
                    className="rounded-xl cursor-pointer hover:bg-secondary"
                  >
                    <div className="flex items-center gap-3 py-2.5 px-2 w-full">
                      <LogOut className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Déconnexion</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="w-[90vw] max-w-md rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        Cette action est irréversible. Elle supprimera définitivement votre compte, 
                        vos photos, vos matchs et vos messages.
                      </p>
                      <p className="font-medium text-foreground">
                        Veuillez taper <strong className="text-destructive">SUPPRIMER</strong> pour confirmer.
                      </p>
                      <Input 
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder="SUPPRIMER"
                        className="mt-2"
                      />
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
                    <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={(e) => {
                        if (deleteConfirm !== "SUPPRIMER") {
                          e.preventDefault();
                          toast.error("Veuillez taper SUPPRIMER pour confirmer.");
                        } else {
                          handleDeleteAccount();
                        }
                      }}
                      className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Suppression..." : "Supprimer mon compte"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
