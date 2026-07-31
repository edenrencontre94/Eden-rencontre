import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Globe, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/parametres/langue")({
  head: () => ({
    meta: [{ title: "Langue — AgapeMeet" }],
  }),
  component: LanguagePage,
});

const languages = [
  { id: "fr", name: "Français", region: "France" },
  { id: "en", name: "English", region: "United States" },
  { id: "es", name: "Español", region: "España" },
];

function LanguagePage() {
  const [lang, setLang] = useState("fr");

  useEffect(() => {
    const saved = localStorage.getItem("agape_lang");
    if (saved) setLang(saved);
  }, []);

  const selectLang = (id: string) => {
    setLang(id);
    localStorage.setItem("agape_lang", id);
    toast.success("Langue mise à jour");
  };

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
          L'application est principalement disponible en français pour le moment.
        </p>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl p-3 shadow-soft space-y-1">
        {languages.map((l) => {
          const isActive = lang === l.id;
          return (
            <button
              key={l.id}
              onClick={() => selectLang(l.id)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-colors ${
                isActive ? "bg-primary/5" : "hover:bg-secondary"
              }`}
            >
              <div className="flex flex-col items-start">
                <span className={`font-medium ${isActive ? "text-primary" : "text-foreground"}`}>
                  {l.name}
                </span>
                <span className="text-xs text-muted-foreground">{l.region}</span>
              </div>
              {isActive && <Check className="w-5 h-5 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
