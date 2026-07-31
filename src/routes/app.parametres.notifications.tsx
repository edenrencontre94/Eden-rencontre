import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BellRing, Smartphone, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/parametres/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — AgapeMeet" }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [prefs, setPrefs] = useState({
    push_messages: true,
    push_matches: true,
    email_messages: false,
    email_newsletter: true
  });

  useEffect(() => {
    // Load from local storage
    const saved = localStorage.getItem("agape_notif_prefs");
    if (saved) {
      try {
        setPrefs(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleToggle = (key: keyof typeof prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem("agape_notif_prefs", JSON.stringify(next));
    toast.success("Préférences enregistrées");
  };

  return (
    <div className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/app" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold">Notifications</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-6 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <BellRing className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm text-center text-muted-foreground px-4">
          Choisissez comment vous souhaitez être informé(e) des nouveautés.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-border/50 rounded-3xl p-5 sm:p-6 shadow-soft">
          <div className="flex items-center gap-3 mb-6">
            <Smartphone className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-lg font-medium">Push / App</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Nouveaux messages</p>
                <p className="text-xs text-muted-foreground">Quand quelqu'un vous écrit</p>
              </div>
              <Switch 
                checked={prefs.push_messages}
                onCheckedChange={() => handleToggle("push_messages")}
              />
            </div>
            <div className="h-px bg-border/50 w-full" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Nouveaux Matchs</p>
                <p className="text-xs text-muted-foreground">Quand l'intérêt est mutuel</p>
              </div>
              <Switch 
                checked={prefs.push_matches}
                onCheckedChange={() => handleToggle("push_matches")}
              />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-3xl p-5 sm:p-6 shadow-soft">
          <div className="flex items-center gap-3 mb-6">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-lg font-medium">Emails</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Messages non lus</p>
                <p className="text-xs text-muted-foreground">Résumé des messages ratés</p>
              </div>
              <Switch 
                checked={prefs.email_messages}
                onCheckedChange={() => handleToggle("email_messages")}
              />
            </div>
            <div className="h-px bg-border/50 w-full" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Actualités AgapeMeet</p>
                <p className="text-xs text-muted-foreground">Nouveautés et offres</p>
              </div>
              <Switch 
                checked={prefs.email_newsletter}
                onCheckedChange={() => handleToggle("email_newsletter")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
