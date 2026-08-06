import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X, Lock, MapPin, Crown, RotateCcw, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  DEFAULT_FILTERS, countActiveFilters, fetchFilterOptions,
  enableLocation, disableLocation, type Filters, type FilterOptions,
} from "@/lib/filtres";
import { MARITAL_STATUSES, formatHeight } from "@/lib/profilChamps";
import { Switch } from "@/components/ui/switch";

/**
 * Panneau de filtres.
 *
 * Les filtres avancés sont AFFICHÉS aux comptes gratuits, verrouillés
 * plutôt que masqués. Cacher une fonctionnalité payante ne la vend pas :
 * on ne désire pas ce qu'on ignore. En revanche le verrou est réel — la
 * fonction en base annule ces critères pour un compte gratuit, même si la
 * requête est forgée à la main.
 */
export function FilterSheet({
  filters,
  onApply,
  onClose,
  canUseAdvanced,
  locationShared,
  onLocationChange,
}: {
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
  canUseAdvanced: boolean;
  locationShared: boolean;
  onLocationChange: (shared: boolean) => void;
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Filters>(filters);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => { fetchFilterOptions().then(setOptions); }, []);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft(d => ({ ...d, [key]: value }));

  const toggleIn = (key: keyof Filters, value: string) => {
    const list = draft[key] as string[];
    set(key, (list.includes(value) ? list.filter(v => v !== value) : [...list, value]) as any);
  };

  const upsell = () => {
    toast.error("Les filtres avancés sont réservés aux membres Premium", {
      action: { label: "Voir les formules", onClick: () => navigate({ to: "/abonnement" }) },
    });
  };

  const toggleLocation = async (next: boolean) => {
    setLocating(true);
    if (next) {
      const res = await enableLocation();
      if (!res.ok) {
        toast.error(
          res.reason === "refuse"
            ? "Localisation refusée. Autorisez-la dans les réglages de votre navigateur."
            : res.reason === "indisponible"
              ? "Votre appareil ne fournit pas de position."
              : "La position n'a pas pu être enregistrée.",
        );
        setLocating(false);
        return;
      }
      onLocationChange(true);
      toast.success("Position enregistrée. Vous pouvez filtrer par distance.");
    } else {
      await disableLocation();
      onLocationChange(false);
      set("maxKm", null);
    }
    setLocating(false);
  };

  const active = countActiveFilters(draft);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-[32px] max-h-[92vh] overflow-y-auto shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
      >
        <div className="sticky top-0 bg-background/95 backdrop-blur px-6 pt-6 pb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">
            Filtres {active > 0 && <span className="text-primary">· {active}</span>}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDraft(DEFAULT_FILTERS)}
              className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
              aria-label="Réinitialiser"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary" aria-label="Fermer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-7">
          {/* ── Base, ouverte à tous ────────────────────────── */}
          <Section title="Filtres de base">
            <Row label="Pays">
              <select
                value={draft.country}
                onChange={e => set("country", e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm"
              >
                <option value="">Tous les pays</option>
                {(options?.pays ?? []).map(p => (
                  <option key={p.valeur} value={p.valeur}>
                    {p.valeur} ({p.n})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Le nombre entre parenthèses indique les membres inscrits.
              </p>
            </Row>

            <Row label={`Âge · ${draft.ageMin} à ${draft.ageMax} ans`}>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={18} max={80} value={draft.ageMin}
                  onChange={e => set("ageMin", Math.min(Number(e.target.value), draft.ageMax))}
                  className="flex-1 accent-primary"
                />
                <input
                  type="range" min={18} max={80} value={draft.ageMax}
                  onChange={e => set("ageMax", Math.max(Number(e.target.value), draft.ageMin))}
                  className="flex-1 accent-primary"
                />
              </div>
            </Row>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Profils vérifiés uniquement</p>
                <p className="text-[11px] text-muted-foreground">Identité confirmée par notre équipe</p>
              </div>
              <Switch
                checked={draft.verifiedOnly}
                onCheckedChange={v => set("verifiedOnly", v)}
              />
            </div>
          </Section>

          {/* ── Avancés ─────────────────────────────────────── */}
          <div className={canUseAdvanced ? "" : "relative"}>
            {!canUseAdvanced && (
              <button
                onClick={upsell}
                className="absolute inset-0 z-10 rounded-2xl bg-background/60 backdrop-blur-[2px] flex items-start justify-center pt-16"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gold text-gold-foreground text-sm font-semibold shadow-elegant">
                  <Crown className="w-4 h-4" /> Débloquer avec Premium
                </span>
              </button>
            )}

            <Section
              title="Filtres avancés"
              badge={!canUseAdvanced ? "Premium" : undefined}
            >
              {/* Localisation */}
              <div className="rounded-2xl border border-border p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-primary" /> Profils près de moi
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Votre position est arrondie à environ 100 m et n'est jamais
                      affichée : seule la distance l'est.
                    </p>
                  </div>
                  {locating ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0 mt-1" />
                  ) : (
                    <Switch
                      checked={locationShared}
                      onCheckedChange={toggleLocation}
                      disabled={!canUseAdvanced}
                    />
                  )}
                </div>

                {locationShared && (
                  <div className="mt-3.5 pt-3.5 border-t border-border/60">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs font-medium">Rayon</span>
                      <span className="text-xs font-bold text-primary">
                        {draft.maxKm ? `${draft.maxKm} km` : "Sans limite"}
                      </span>
                    </div>
                    <input
                      type="range" min={0} max={500} step={10}
                      value={draft.maxKm ?? 0}
                      onChange={e => {
                        const v = Number(e.target.value);
                        set("maxKm", v === 0 ? null : v);
                      }}
                      disabled={!canUseAdvanced}
                      className="w-full accent-primary"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Les profils qui ne partagent pas leur position sont écartés
                      dès qu'un rayon est défini.
                    </p>
                  </div>
                )}
              </div>

              <Row label="Situation matrimoniale">
                <Chips
                  options={MARITAL_STATUSES.map(s => ({ value: s.key, label: s.label }))}
                  selected={draft.marital}
                  onToggle={v => canUseAdvanced ? toggleIn("marital", v) : upsell()}
                />
              </Row>

              <Row label="Confession / Dénomination">
                <Chips
                  options={(options?.denominations ?? []).map(d => ({
                    value: d.valeur, label: `${d.valeur} (${d.n})`,
                  }))}
                  selected={draft.denomination}
                  onToggle={v => canUseAdvanced ? toggleIn("denomination", v) : upsell()}
                />
              </Row>

              <Row label="Fréquentation de l'église">
                <Chips
                  options={(options?.frequentation ?? []).map(v => ({ value: v, label: v }))}
                  selected={draft.attendance}
                  onToggle={v => canUseAdvanced ? toggleIn("attendance", v) : upsell()}
                />
              </Row>

              <Row label="Intention de mariage">
                <Chips
                  options={(options?.intentions ?? []).map(v => ({ value: v, label: v }))}
                  selected={draft.intent}
                  onToggle={v => canUseAdvanced ? toggleIn("intent", v) : upsell()}
                />
              </Row>

              <Row label="Niveau d'études">
                <Chips
                  options={(options?.etudes ?? []).map(v => ({ value: v, label: v }))}
                  selected={draft.education}
                  onToggle={v => canUseAdvanced ? toggleIn("education", v) : upsell()}
                />
              </Row>

              <Row
                label={
                  draft.heightMin || draft.heightMax
                    ? `Taille · ${formatHeight(draft.heightMin ?? 140)} à ${formatHeight(draft.heightMax ?? 210)}`
                    : "Taille · indifférent"
                }
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={140} max={210}
                    value={draft.heightMin ?? 140}
                    onChange={e => canUseAdvanced
                      ? set("heightMin", Math.min(Number(e.target.value), draft.heightMax ?? 210))
                      : upsell()}
                    className="flex-1 accent-primary"
                  />
                  <input
                    type="range" min={140} max={210}
                    value={draft.heightMax ?? 210}
                    onChange={e => canUseAdvanced
                      ? set("heightMax", Math.max(Number(e.target.value), draft.heightMin ?? 140))
                      : upsell()}
                    className="flex-1 accent-primary"
                  />
                </div>
                {(draft.heightMin || draft.heightMax) && (
                  <button
                    onClick={() => { set("heightMin", null); set("heightMax", null); }}
                    className="text-[11px] text-muted-foreground underline mt-1"
                  >
                    Ne pas filtrer sur la taille
                  </button>
                )}
              </Row>
            </Section>
          </div>
        </div>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur px-6 py-4 border-t border-border">
          <button
            onClick={() => { onApply(draft); onClose(); }}
            className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-elegant"
          >
            Appliquer{active > 0 ? ` · ${active} filtre${active > 1 ? "s" : ""}` : ""}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function Section({ title, badge, children }: {
  title: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        {title}
        {badge && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/20 text-gold text-[10px] font-bold normal-case tracking-normal">
            <Lock className="w-3 h-3" /> {badge}
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      {children}
    </div>
  );
}

/**
 * Sélection multiple par étiquettes.
 *
 * Un menu déroulant à choix unique obligerait à relancer une recherche par
 * confession. Ici, cocher « Catholique » et « Évangélique » élargit au lieu
 * de remplacer — c'est ce qu'on attend d'un filtre de rencontre.
 */
function Chips({ options, selected, onToggle }: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-[11px] text-muted-foreground italic">Aucune valeur renseignée pour l'instant.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              on
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {on && <Check className="w-3 h-3" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
