import { useState } from "react";
import { X, Plus } from "lucide-react";

/**
 * Sélection d'étiquettes : suggestions cochables + saisie libre.
 *
 * Les suggestions font l'essentiel du travail — on choisit plus vite qu'on
 * n'écrit, et le vocabulaire reste homogène, ce qui rendra les filtres
 * possibles plus tard. La saisie libre reste ouverte : aucune liste ne
 * couvre tout le monde, et forcer quelqu'un dans une case toute faite est
 * la meilleure façon de lui faire abandonner le formulaire.
 */
export function TagPicker({
  value,
  onChange,
  suggestions,
  max,
  placeholder = "Ajouter…",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  max: number;
  placeholder?: string;
}) {
  const [custom, setCustom] = useState("");
  const full = value.length >= max;

  const toggle = (tag: string) => {
    if (value.includes(tag)) {
      onChange(value.filter(t => t !== tag));
      return;
    }
    if (full) return;
    onChange([...value, tag]);
  };

  const addCustom = () => {
    const t = custom.trim();
    if (!t || full) return;
    // Comparaison insensible à la casse : « Louange » et « louange »
    // créeraient deux étiquettes distinctes dans les statistiques.
    if (value.some(v => v.toLowerCase() === t.toLowerCase())) {
      setCustom("");
      return;
    }
    onChange([...value, t.slice(0, 40)]);
    setCustom("");
  };

  return (
    <div>
      {/* Sélection courante */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {value.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(value.filter(t => t !== tag))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium"
            >
              {tag}
              <X className="w-3 h-3 opacity-80" />
            </button>
          ))}
        </div>
      )}

      {/* Suggestions non encore retenues */}
      <div className="flex flex-wrap gap-1.5">
        {suggestions
          .filter(s => !value.includes(s))
          .map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              disabled={full}
              className="px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-40"
            >
              {s}
            </button>
          ))}
      </div>

      <div className="flex gap-2 mt-2.5">
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              // Sans cela, la touche Entrée soumettrait le formulaire
              // entier et l'étiquette serait perdue.
              e.preventDefault();
              addCustom();
            }
          }}
          disabled={full}
          maxLength={40}
          placeholder={full ? `Maximum ${max} atteint` : placeholder}
          className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={full || !custom.trim()}
          className="px-3 py-2 rounded-xl border border-border text-sm hover:bg-secondary disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground mt-1.5">
        {value.length}/{max}
      </p>
    </div>
  );
}
