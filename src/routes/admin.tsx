import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, ShieldAlert, CreditCard, Megaphone, Settings, LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const adminMenus = [
  { to: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { to: "/admin/moderation", label: "Modération", icon: ShieldAlert },
  { to: "/admin/abonnements", label: "Abonnements", icon: CreditCard },
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/parametres", label: "Paramètres", icon: Settings },
];

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      const user = await getCurrentUser();

      // Pas de compte → on l'oriente vers l'inscription.
      // `replace: true` retire /admin de l'historique : le bouton Retour
      // ne le ramènera pas ici en boucle.
      if (!user) {
        navigate({ to: "/inscription", replace: true });
        return;
      }

      // Le rôle est décidé EN BASE, jamais ici. `is_admin()` lit
      // profiles.role pour auth.uid(), et un trigger empêche quiconque
      // de modifier son propre rôle. Cet écran ne fait que refléter
      // une décision serveur : même contourné, il ne donnerait accès
      // à rien, les policies RLS refusant les données.
      const { data, error } = await supabase.rpc("is_admin");

      if (error) {
        console.error("[admin] vérification du rôle:", error);
        navigate({ to: "/accueil", replace: true });
        return;
      }

      if (!data) {
        // Membre connecté sans droits : renvoyé à l'accueil sans un mot.
        // Un message du type « accès refusé » confirmerait qu'un
        // back-office existe à cette adresse, ce qui inviterait à insister.
        navigate({ to: "/accueil", replace: true });
        return;
      }

      setIsAdmin(true);
    }
    checkAdmin();
  }, [navigate]);

  // Tant que le rôle n'est pas tranché — et pendant la redirection des
  // non-autorisés — on n'affiche qu'un écran neutre. Il ne doit rien
  // laisser deviner du contenu qui se trouve derrière.
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/20 flex font-sans text-foreground">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <img src={logo} alt="AgapeMeet Admin" className="w-8 h-8 object-contain" />
          <span className="font-serif text-xl font-bold text-primary">AgapeAdmin</span>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {adminMenus.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  active 
                    ? "bg-primary text-primary-foreground shadow-soft" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login" });
            }}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-sm font-medium"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="md:hidden bg-card border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="AgapeMeet" className="w-8 h-8 object-contain" />
            <span className="font-serif font-bold text-primary">Admin</span>
          </div>
          <div className="text-sm text-muted-foreground">Ouvrez sur PC pour plus de confort</div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
