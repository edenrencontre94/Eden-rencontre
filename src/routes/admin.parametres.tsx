import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Settings, Shield, Wrench, Save, AlertTriangle, Users, Rocket, Mail, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/auth";
import { invalidateSettings } from "@/lib/appSettings";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/parametres")({
  component: AdminParametres,
});

/**
 * Réglages réellement appliqués.
 *
 * Cette page simulait un enregistrement — `await new Promise(r =>
 * setTimeout(r, 800))` suivi d'un message de succès — sans rien écrire.
 * Chaque valeur est désormais stockée dans `app_settings` et LUE par les
 * fonctions de la base : modifier un quota ici change immédiatement le
 * comportement de l'application, sans redéploiement.
 */

type Settings = Record<string, any>;

const NUMERIC_FIELDS: { key: string; label: string; hint: string; icon: any }[] = [
  {
    key: "free_messages_per_day",
    label: "Messages par jour — Gratuit",
    hint: "Appliqué par un trigger sur la table messages",
    icon: Mail,
  },
  {
    key: "free_likes_per_day",
    label: "Likes par jour — Gratuit",
    hint: "Appliqué par un trigger sur la table swipes",
    icon: Users,
  },
  {
    key: "free_superlike_cooldown_days",
    label: "Délai entre Super Likes — Gratuit",
    hint: "En jours. Au-delà, le Super Like redevient disponible",
    icon: Users,
  },
  {
    key: "boost_duration_minutes",
    label: "Durée du Boost inclus",
    hint: "En minutes. Ne concerne pas les Boosts achetés à l'unité",
    icon: Rocket,
  },
  {
    key: "email_daily_cap",
    label: "E-mails facultatifs par jour",
    hint: "Par membre. Protège la réputation du domaine d'envoi",
    icon: Mail,
  },
];

function AdminParametres() {
  const [settings, setSettings] = useState<Settings>({});
  const [initial, setInitial] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from("app_settings")
        .select("key, value");

      if (err) {
        console.error("[admin/paramètres]", err);
        setError("Lecture impossible. La migration 32 a-t-elle été exécutée ?");
        setLoading(false);
        return;
      }

      const map: Settings = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      setSettings(map);
      setInitial(map);
      setLoading(false);
    }
    load();
  }, []);

  const dirty = JSON.stringify(settings) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    const userId = await getCurrentUserId();

    // On n'écrit QUE ce qui a changé : moins d'écritures, et l'horodatage
    // de modification reste significatif pour les autres réglages.
    const changed = Object.keys(settings).filter(
      k => JSON.stringify(settings[k]) !== JSON.stringify(initial[k]),
    );

    for (const key of changed) {
      const { error: err } = await supabase
        .from("app_settings")
        .update({ value: settings[key], updated_at: new Date().toISOString(), updated_by: userId })
        .eq("key", key);

      if (err) {
        console.error("[admin/paramètres] écriture:", err);
        toast.error(`Impossible d'enregistrer « ${key} »`);
        setSaving(false);
        return;
      }
    }

    setInitial(settings);
    // Le cache client garde les réglages pour toute la durée de la page :
    // sans cette invalidation, activer le mode maintenance n'aurait d'effet
    // qu'au prochain rechargement complet.
    invalidateSettings();
    setSaving(false);
    toast.success(
      changed.length === 0 ? "Aucune modification" : `${changed.length} réglage(s) enregistré(s)`,
    );
  };

  const setValue = (key: string, value: any) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 rounded bg-secondary animate-pulse" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-secondary animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold">Paramètres</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Ces valeurs sont lues directement par la base. Une modification prend
            effet immédiatement, sans redéploiement.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-elegant disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {dirty ? "Enregistrer" : "À jour"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Accès à la plateforme */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" /> Accès à la plateforme
        </h2>

        <div className="mt-5 space-y-5">
          <ToggleRow
            label="Mode maintenance"
            hint="Ferme l'application à tous les membres. Les administrateurs conservent l'accès."
            checked={settings.maintenance_mode === true}
            onChange={v => setValue("maintenance_mode", v)}
            danger
          />
          <div className="h-px bg-border/60" />
          <ToggleRow
            label="Inscriptions ouvertes"
            hint="Désactivé, le formulaire d'inscription refuse les nouveaux comptes."
            checked={settings.registration_open === true}
            onChange={v => setValue("registration_open", v)}
          />
        </div>

        {settings.maintenance_mode === true && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              Le mode maintenance est actif : vos membres ne peuvent plus utiliser
              l'application. Pensez à le désactiver après l'intervention.
            </p>
          </div>
        )}
      </section>

      {/* Quotas */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Limites et quotas
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ces valeurs sont imposées par des triggers en base — elles ne se
          contournent pas depuis le navigateur.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {NUMERIC_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <f.icon className="w-3.5 h-3.5" /> {f.label}
              </label>
              <input
                type="number"
                min={0}
                value={settings[f.key] ?? ""}
                onChange={e => setValue(f.key, Number(e.target.value))}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[11px] text-muted-foreground mt-1">{f.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ce qui n'est volontairement pas ici */}
      <section className="rounded-2xl border border-border bg-secondary/40 p-5">
        <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted-foreground" /> Réglages non modifiables ici
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Tarifs des formules</strong> — définis sur Chariow.
            Les modifier ici n'aurait aucun effet : c'est le prix du produit Chariow qui est
            réellement encaissé.
          </li>
          <li>
            <strong className="text-foreground">Quotas Premium et VIP</strong> — liés aux durées
            vendues. Les changer reviendrait à modifier ce que vos abonnés ont déjà payé.
          </li>
          <li>
            <strong className="text-foreground">Rôles administrateurs</strong> — attribués en base,
            volontairement hors interface pour éviter toute promotion accidentelle.
          </li>
        </ul>
      </section>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, danger }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className={`font-medium text-sm ${danger && checked ? "text-destructive" : ""}`}>{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
