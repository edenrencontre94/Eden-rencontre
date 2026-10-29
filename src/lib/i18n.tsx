import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { translations, type Language, type TranslationKey } from "@/locales/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "eden_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === "fr" || stored === "en") {
        return stored;
      }
      // Detect browser language
      const browserLang = navigator.language?.toLowerCase() || "";
      if (browserLang.startsWith("en")) {
        return "en";
      }
    } catch (e) {
      // LocalStorage access might fail in private browsing
    }
    return "fr";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch (e) {
      console.error("Could not persist language to localStorage", e);
    }
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch (e) {}
  }, [language]);

  const t = useMemo(() => {
    return (key: TranslationKey, params?: Record<string, string | number>): string => {
      const langDict = translations[language] || translations.fr;
      let val: string = (langDict as any)[key] || (translations.fr as any)[key] || key;

      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          val = val.replace(new RegExp(`\\{${pKey}\\}`, "g"), String(pVal));
        });
      }

      return val;
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Fallback safe implementation if used outside provider
    return {
      language: "fr" as Language,
      setLanguage: () => {},
      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        let val: string = (translations.fr as any)[key] || key;
        if (params) {
          Object.entries(params).forEach(([pKey, pVal]) => {
            val = val.replace(new RegExp(`\\{${pKey}\\}`, "g"), String(pVal));
          });
        }
        return val;
      },
    };
  }
  return ctx;
}
