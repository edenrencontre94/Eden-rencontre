import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { fallbackVerses, fallbackChallenges, fallbackAdvices } from "@/lib/mock-data";

export type DailyContent = {
  verse_text: string;
  verse_ref: string;
  challenge_title: string;
  challenge_text: string;
  advice_text: string;
  advice_source: string;
  advice_ref: string;
};

export function useDailyContent() {
  const [content, setContent] = useState<DailyContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDailyContent() {
      try {
        // Obtenir la date du jour au format YYYY-MM-DD locale
        const today = new Date();
        const dateString = today.toLocaleDateString('en-CA'); // format YYYY-MM-DD

        const { data, error } = await supabase
          .from("app_daily_content")
          .select("*")
          .eq("date", dateString)
          .single();

        if (data && !error) {
          setContent(data);
        } else {
          // Fallback : sélection déterministe basée sur le jour de l'année
          const startOfYear = new Date(today.getFullYear(), 0, 0);
          const diff = today.getTime() - startOfYear.getTime();
          const dayOfYear = Math.floor(diff / 86400000);

          const verse = fallbackVerses[dayOfYear % fallbackVerses.length];
          const challenge = fallbackChallenges[dayOfYear % fallbackChallenges.length];
          const advice = fallbackAdvices[dayOfYear % fallbackAdvices.length];

          setContent({
            verse_text: verse.text,
            verse_ref: verse.ref,
            challenge_title: challenge.title,
            challenge_text: challenge.text,
            advice_text: advice.text,
            advice_source: advice.source,
            advice_ref: advice.ref,
          });
        }
      } catch (err) {
        console.error("Erreur chargement daily content:", err);
        // Fallback en cas d'erreur inattendue (ex: pas de connexion)
        const verse = fallbackVerses[0];
        const challenge = fallbackChallenges[0];
        const advice = fallbackAdvices[0];
        setContent({
          verse_text: verse.text,
          verse_ref: verse.ref,
          challenge_title: challenge.title,
          challenge_text: challenge.text,
          advice_text: advice.text,
          advice_source: advice.source,
          advice_ref: advice.ref,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchDailyContent();
  }, []);

  return { content, loading };
}
