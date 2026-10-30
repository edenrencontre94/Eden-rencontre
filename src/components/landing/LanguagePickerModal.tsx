import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "@/lib/i18n";
import type { Language } from "@/locales/translations";

const STORAGE_KEY = "eden_language";

function FlagFR({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      <rect width="20" height="40" fill="#002395" />
      <rect x="20" width="20" height="40" fill="#ffffff" />
      <rect x="40" width="20" height="40" fill="#ED2939" />
    </svg>
  );
}

function FlagEN({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

interface LangOption {
  code: Language;
  labelKey: "langpicker.french_label" | "langpicker.english_label";
  nativeName: string;
  Flag: (props: { className?: string }) => React.ReactElement;
}

const LANG_OPTIONS: LangOption[] = [
  { code: "fr", labelKey: "langpicker.french_label", nativeName: "Français", Flag: FlagFR },
  { code: "en", labelKey: "langpicker.english_label", nativeName: "English", Flag: FlagEN },
];

export function LanguagePickerModal() {
  const { setLanguage, language } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<Language>(language);

  useEffect(() => {
    // Show only when no language has been explicitly saved (true first visit)
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Small delay so the landing page hero loads first
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage not available — skip
    }
  }, []);

  const handleConfirm = () => {
    setLanguage(selected);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="langpicker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            key="langpicker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="langpicker-title"
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[201] flex items-center justify-center px-4"
          >
            <div className="w-full max-w-sm bg-card border border-border/60 rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6">
              {/* Logo + Title */}
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <span className="text-3xl" aria-hidden="true">🌍</span>
                </div>
                <div>
                  <h2
                    id="langpicker-title"
                    className="font-serif text-2xl font-semibold text-foreground tracking-tight"
                  >
                    {selected === "en" ? "Choose your language" : "Choisissez votre langue"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs leading-relaxed">
                    {selected === "en"
                      ? "Select the language you'd like to use on Eden Rencontre."
                      : "Sélectionnez la langue dans laquelle vous souhaitez utiliser Eden Rencontre."}
                  </p>
                </div>
              </div>

              {/* Language options */}
              <div className="w-full flex flex-col gap-3">
                {LANG_OPTIONS.map(({ code, nativeName, Flag }) => (
                  <motion.button
                    key={code}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelected(code)}
                    className={`relative w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all ${
                      selected === code
                        ? "border-primary bg-primary/8 shadow-md"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                    aria-pressed={selected === code}
                  >
                    <Flag className="w-10 h-7 rounded-md shadow-sm shrink-0 object-cover" />
                    <span className="flex-1">
                      <span className="block font-semibold text-foreground text-base">{nativeName}</span>
                    </span>
                    {selected === code && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0"
                      >
                        <svg viewBox="0 0 12 10" className="w-3 h-3 text-primary-foreground" fill="currentColor">
                          <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </motion.span>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Confirm */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirm}
                className="w-full rounded-2xl bg-primary text-primary-foreground font-semibold py-3.5 text-base shadow-soft hover:bg-primary/90 transition-colors"
              >
                {selected === "en" ? "Continue" : "Continuer"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
