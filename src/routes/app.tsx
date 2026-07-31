import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { BottomNav } from "@/components/app/BottomNav";
import { Bell, Crown, User } from "lucide-react";
import { SubscriptionProvider } from "@/lib/subscription";
import logo from "@/assets/logo.jpg";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
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
            <Link
              to="/app/profil"
              aria-label="Mon Profil"
              className="w-9 h-9 rounded-full border border-border bg-background hover:bg-secondary flex items-center justify-center"
            >
              <User className="w-4 h-4" />
            </Link>
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