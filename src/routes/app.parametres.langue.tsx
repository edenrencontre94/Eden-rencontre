import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Globe, Check, Lock } from "lucide-react";

export const Route = createFileRoute("/app/parametres/langue")({
  head: () => ({
    meta: [{ title: "Langue — AgapeMeet" }],
  }),
  component: LanguagePage,
});

const languages = [
  { id: "fr", name: "Français", region: "France", available: true },
  { id: "en", name: "English", region: "United States", available: false },
  { id: "es", name: "Español", region: "España", available: false },
];

function LanguagePage() {
  return (
    <div className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/app" className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold">Langue</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-6 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Globe className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm text-center text-muted-foreground px-4">
          AgapeMeet est actuellement disponible en Français. D'autres langues arrivent bientôt !
        </p>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl p-3 shadow-soft space-y-1">
        {languages.map((l) => {
          const isActive = l.id === "fr";
          return (
            <div
              key={l.id}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-colors ${
                l.available ? "bg-primary/5" : "opacity-50"
              }`}
            >
              <div className="flex flex-col items-start">
                <span className={`font-medium ${isActive ? "text-primary" : "text-foreground"}`}>
                  {l.name}
                </span>
                <span className="text-xs text-muted-foreground">{l.region}</span>
              </div>
              <div className="flex items-center gap-2">
                {!l.available && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border uppercase tracking-wide">
                    Bientôt
                  </span>
                )}
                {isActive && <Check className="w-5 h-5 text-primary" />}
                {!l.available && <Lock className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground mt-6 px-4">
        Vous souhaitez aider à traduire AgapeMeet ? <br />
        Contactez-nous à <a href="mailto:contact@agapemeet.com" className="text-primary hover:underline">contact@agapemeet.com</a>
      </p>
    </div>
  );
}
