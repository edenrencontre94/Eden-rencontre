import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Flame, MessageCircle, Heart, Users } from "lucide-react";
import { motion } from "motion/react";

type NavItem = {
  to: "/accueil" | "/accueil/decouvrir" | "/accueil/messages" | "/accueil/demandes" | "/accueil/communaute";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const items: NavItem[] = [
  { to: "/accueil", label: "Accueil", icon: Home, exact: true },
  { to: "/accueil/decouvrir", label: "Découvrir", icon: Flame },
  { to: "/accueil/messages", label: "Messages", icon: MessageCircle },
  { to: "/accueil/demandes", label: "Demandes", icon: Heart },
  { to: "/accueil/communaute", label: "Communauté", icon: Users },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.to
            : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className="relative flex flex-col items-center justify-center py-2.5 gap-1 group"
            >
              {active && (
                <motion.span
                  layoutId="bnav-active"
                  className="absolute top-0 h-0.5 w-10 bg-gradient-to-r from-primary to-primary/60 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`w-5 h-5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-medium tracking-wide ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}