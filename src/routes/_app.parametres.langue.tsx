import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Globe, Check, Lock } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { toast } from "sonner";
import type { Language } from "@/locales/translations";

export const Route = createFileRoute("/_app/parametres/langue")({
  head: () => ({
    meta: [{ title: "Langue – Eden Rencontre" }],
  }),
  component: LanguagePage,
});

interface LangOption {
  id: Language | "es";
  name: string;
  region: string;
  available: boolean;
}

const languages: LangOption[] = [
  { id: "fr", name: "Français", region: "France / Francophonie", available: true },
  { id: "en", name: "English", region: "International", available: true },
  { id: "es", name: "Español", region: "España / Latinoamérica", available: false },
];

function LanguagePage() {
  const { language, setLanguage, t } = useTranslation();

  const handleSelectLanguage = (langId: Language | "es") => {
    if (langId === "es") return;
    setLanguage(langId);
    toast.success(t("lang.saved"));
  };

  return (
    <div className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link
          to="/accueil"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold">{t("lang.title")}</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-6 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Globe className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm text-center text-muted-foreground px-4">
          {t("lang.subtitle")}
        </p>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl p-3 shadow-soft space-y-2">
        {languages.map((l) => {
          const isActive = language === l.id;
          return (
            <button
              key={l.id}
              type="button"
              disabled={!l.available}
              onClick={() => handleSelectLanguage(l.id)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all text-left ${
                isActive
                  ? "bg-primary/10 border border-primary/20"
                  : l.available
                  ? "hover:bg-secondary cursor-pointer"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="flex flex-col items-start">
                <span
                  className={`font-medium ${
                    isActive ? "text-primary font-semibold" : "text-foreground"
                  }`}
                >
                  {l.name}
                </span>
                <span className="text-xs text-muted-foreground">{l.region}</span>
              </div>
              <div className="flex items-center gap-2">
                {!l.available && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border uppercase tracking-wide">
                    {t("lang.soon")}
                  </span>
                )}
                {isActive && <Check className="w-5 h-5 text-primary" />}
                {!l.available && <Lock className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground mt-6 px-4">
        {t("lang.help_translate")} <br />
        {t("lang.contact_us")}{" "}
        <a href="mailto:contact@edenrencontres.com" className="text-primary hover:underline">
          contact@edenrencontres.com
        </a>
      </p>
    </div>
  );
}
