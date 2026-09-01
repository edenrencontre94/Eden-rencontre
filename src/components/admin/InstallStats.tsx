import { useEffect, useState } from "react";
import {
  Smartphone, Apple, Monitor, TrendingUp, BellRing, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Installations de l'application sur les appareils des membres.
 *
 * Appel séparé de `admin_analytics` : la statistique peut ne pas être
 * exécutée alors que le reste de la page fonctionne. Une seule requête
 * pour les deux ferait disparaître toute la page d'analyse à cause d'un
 * bloc secondaire.
 */

type Stats = {
  total: number;
  periode: number;
  vivantes: number;
  actifs: number;
  actifs_installes: number;
  part_actifs: number;
  par_plateforme: { plateforme: string; n: number; confirmees: number }[];
  courbe: { jour: string; n: number }[];
  engagement: {
    installes_n: number;
    non_installes_n: number;
    msg_installes: number;
    msg_non_installes: number;
  };
  push: { installes: number; non_installes: number; part_installes: number };
};

const PLATEFORMES: Record<string, { label: string; icone: any }> = {
  android: { label: "Android", icone: Smartphone },
  ios: { label: "iPhone", icone: Apple },
  desktop: { label: "Ordinateur", icone: Monitor },
  autre: { label: "Autre", icone: Monitor },
};

export function InstallStats({ days }: { days: number }) {
  const [data, setData] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    supabase.rpc("admin_install_stats", { p_days: days }).then(({ data: r, error }: any) => {
      if (annule) return;
      if (error || (r as any)?.error) {
        console.error("[admin/installations]", error ?? r);
        setErreur(true);
        return;
      }
      setErreur(false);
      setData(r as Stats);
    });
    return () => { annule = true; };
  }, [days]);

  if (erreur) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Statistiques d'installation indisponibles.
        </p>
      </section>
    );
  }

  if (!data || !data.engagement) return <div className="h-48 rounded-2xl bg-secondary animate-pulse" />;

  const e = data.engagement;
  // Le rapport plutôt que la différence : « 3× plus actifs » se retient,
  // « 2,3 messages de plus » ne dit rien à personne.
  const facteur =
    e.msg_non_installes > 0
      ? Math.round((e.msg_installes / e.msg_non_installes) * 10) / 10
      : null;

  const maxCourbe = Math.max(1, ...(data.courbe || []).map(p => p.n));
  const dormantes = Math.max(0, (data.total || 0) - (data.vivantes || 0));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-serif font-semibold flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" /> Installations
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Membres ayant ajouté Eden Rencontre à leur écran d'accueil. Les
          désinstallations ne sont signalées par aucun navigateur : elles se
          déduisent d'une absence prolongée.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Carte
          valeur={String(data.total)}
          label="Membres installés"
          detail={dormantes > 0 ? `${dormantes} sans ouverture depuis 30 j` : undefined}
        />
        <Carte
          valeur={`${data.part_actifs} %`}
          label="Des membres actifs"
          detail={`${data.actifs_installes} sur ${data.actifs}`}
        />
        <Carte
          valeur={`+${data.periode}`}
          label={`Sur ${days} jours`}
        />
        <Carte
          valeur={String(data.vivantes)}
          label="Installations vivantes"
          detail="Ouvertes ces 30 derniers jours"
        />
      </div>

      {/* ── L'indicateur décisif ──────────────────────────────── */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          L'installation change-t-elle le comportement ?
        </h3>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-2xl font-serif font-bold text-primary">
              {e.msg_installes}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              messages par membre installé
            </div>
            <div className="text-[11px] text-muted-foreground">
              sur {e.installes_n} membre{e.installes_n > 1 ? "s" : ""}
            </div>
          </div>
          <div>
            <div className="text-2xl font-serif font-bold text-muted-foreground">
              {e.msg_non_installes}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              par membre non installé
            </div>
            <div className="text-[11px] text-muted-foreground">
              sur {e.non_installes_n} membre{e.non_installes_n > 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {facteur !== null && (
          <p className="text-xs mt-4 pt-3 border-t border-primary/20 leading-relaxed">
            {facteur >= 1.3 ? (
              <>
                Les membres installés écrivent{" "}
                <strong className="text-primary">{facteur} fois plus</strong>.
                L'insistance sur la page d'accueil est justifiée.
              </>
            ) : facteur <= 0.9 ? (
              <>
                Les installés écrivent <strong>moins</strong> que les autres.
                Un écart faible sur peu de membres n'est pas significatif —
                attendez d'avoir plus de volume avant d'en conclure quoi que
                ce soit.
              </>
            ) : (
              <>
                Écart peu marqué ({facteur}×). Trop tôt pour trancher, ou
                l'installation ne change pas grand-chose.
              </>
            )}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Plateformes ──────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Par plateforme</h3>
          <div className="mt-4 space-y-3">
            {(data.par_plateforme || []).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune installation.</p>
            )}
            {(data.par_plateforme || []).map(p => {
              const meta = PLATEFORMES[p.plateforme] ?? PLATEFORMES.autre;
              const pct = data.total > 0 ? Math.round((p.n / data.total) * 100) : 0;
              return (
                <div key={p.plateforme}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <meta.icone className="w-4 h-4 text-muted-foreground" />
                      {meta.label}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {p.n} <span className="text-muted-foreground font-normal">· {pct} %</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary mt-1.5 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  {/* Sur iPhone, l'installation n'est jamais confirmée par
                      le navigateur : elle se déduit d'une ouverture. */}
                  {p.plateforme === "ios" && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Détectées à l'ouverture — Safari ne les signale pas.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Croisement notifications ─────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" /> Et les notifications ?
          </h3>

          <div className="mt-4 space-y-3">
            <Ligne
              label="Installés et abonnés au push"
              valeur={`${data.push?.installes ?? 0}`}
              detail={`${data.push?.part_installes ?? 0} % des installés`}
            />
            <Ligne
              label="Abonnés sans installation"
              valeur={`${data.push?.non_installes ?? 0}`}
              detail="Android uniquement — impossible sur iPhone"
            />
          </div>

          <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border/60 leading-relaxed">
            Sur iPhone, l'installation <strong>conditionne</strong> les
            notifications : Apple les refuse dans un onglet Safari ordinaire.
            Les deux chiffres se lisent ensemble.
          </p>
        </div>
      </div>

      {/* ── Courbe ───────────────────────────────────────────── */}
      {(data.courbe || []).length > 1 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Installations par jour</h3>
          <div className="flex items-end gap-[3px] h-24 mt-4">
            {(data.courbe || []).map(p => (
              <div
                key={p.jour}
                title={`${new Date(p.jour).toLocaleDateString("fr-FR")} — ${p.n}`}
                className="flex-1 bg-primary/70 hover:bg-primary rounded-t transition-colors min-h-[2px]"
                style={{ height: `${(p.n / maxCourbe) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
            <span>{new Date((data.courbe || [])[0]?.jour || Date.now()).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
            <span>Aujourd'hui</span>
          </div>
        </div>
      )}
    </section>
  );
}

function Carte({ valeur, label, detail }: { valeur: string; label: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-2xl font-serif font-bold">{valeur}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {detail && <div className="text-[11px] text-muted-foreground mt-1">{detail}</div>}
    </div>
  );
}

function Ligne({ label, valeur, detail }: { label: string; valeur: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}
      </div>
      <span className="font-semibold tabular-nums shrink-0">{valeur}</span>
    </div>
  );
}
