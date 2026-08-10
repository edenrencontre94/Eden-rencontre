import { useEffect, useState } from "react";
import {
  Sparkles, AlertTriangle, Music2, Instagram, Facebook, Youtube,
  Users, MoreHorizontal, HelpCircle, Globe, MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/plans";

/**
 * Canal d'acquisition — déclaré et mesuré.
 *
 * DEUX SIGNAUX DIFFÉRENTS, et c'est délibéré.
 *
 * Le DÉCLARÉ vient de la question posée à l'inscription. Le MESURÉ vient
 * du paramètre présent dans l'URL au moment du clic.
 *
 * Ils divergent souvent, et l'écart est la donnée la plus utile : quelqu'un
 * qui clique une publicité Facebook peut répondre « une recommandation »,
 * parce qu'un ami lui en avait parlé d'abord. La publicité a capté, l'ami
 * a convaincu. Ne regarder que le clic ferait couper les budgets qui
 * alimentent le bouche-à-oreille.
 *
 * Appel séparé de `admin_analytics` : si la migration 66 n'est pas
 * exécutée, seul ce bloc s'excuse, le reste de la page continue.
 */

type Donnees = {
  periode_jours: number;
  inscrits: number;
  ont_repondu: number;
  taux_reponse: number;
  declare: {
    canal: string; inscrits: number; actifs: number;
    profils: number; matchs: number; payants: number; revenus: number;
  }[];
  mesure: { source: string; inscrits: number; payants: number }[];
  ecart: { mesure: string; declare: string; n: number }[];
};

/** Mêmes libellés et mêmes icônes que l'écran d'inscription. */
const CANAUX: Record<string, { label: string; icone: any; couleur: string }> = {
  tiktok: { label: "TikTok", icone: Music2, couleur: "bg-foreground text-background" },
  instagram: { label: "Instagram", icone: Instagram, couleur: "bg-gradient-to-tr from-fuchsia-500 to-amber-400 text-white" },
  facebook: { label: "Facebook", icone: Facebook, couleur: "bg-[#1877F2] text-white" },
  youtube: { label: "YouTube", icone: Youtube, couleur: "bg-[#FF0000] text-white" },
  whatsapp: { label: "WhatsApp", icone: MessageCircle, couleur: "bg-[#25D366] text-white" },
  recommandation: { label: "Recommandation", icone: Users, couleur: "bg-primary text-primary-foreground" },
  autre: { label: "Autre", icone: MoreHorizontal, couleur: "bg-primary/10 text-primary" },
  non_renseigne: { label: "Non renseigné", icone: HelpCircle, couleur: "bg-secondary text-muted-foreground" },
};

export function CanalAcquisition({ days }: { days: number }) {
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    supabase.rpc("admin_acquisition", { p_days: days }).then(({ data, error }: any) => {
      if (annule) return;
      if (error || data?.error) {
        console.error("[admin/acquisition]", error ?? data);
        setErreur(true);
        return;
      }
      setErreur(false);
      setD(data as Donnees);
    });
    return () => { annule = true; };
  }, [days]);

  if (erreur) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Canal d'acquisition indisponible. Les migrations 63 et 66 ont-elles
          été exécutées ?
        </p>
      </section>
    );
  }

  if (!d) return <div className="h-56 rounded-2xl bg-secondary animate-pulse" />;

  const max = Math.max(1, ...d.declare.map(x => x.inscrits));

  // Le bouche-à-oreille amplifié : arrivés par une publicité, mais qui
  // attribuent leur venue à autre chose.
  const boucheAOreille = d.ecart.filter(
    e => e.declare === "recommandation" && e.mesure !== "recommandation",
  ).reduce((n, e) => n + e.n, 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-serif font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Canal d'acquisition
        </h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          Ce que les membres répondent à l'inscription, suivi jusqu'au revenu.
          Le volume seul ne dit rien : un canal peut amener beaucoup de monde
          et aucun abonné.
        </p>
      </div>

      {/* Taux de réponse : sans lui, les proportions ci-dessous sont
          trompeuses. Un canal peut sembler faible simplement parce que la
          question a été sautée. */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Petite v={String(d.inscrits)} l={`Inscrits sur ${d.periode_jours} j`} />
        <Petite v={String(d.ont_repondu)} l="Ont répondu" />
        <Petite
          v={`${d.taux_reponse} %`}
          l="Taux de réponse"
          alerte={d.taux_reponse < 70}
        />
        <Petite
          v={boucheAOreille > 0 ? String(boucheAOreille) : "—"}
          l="Venus d'une pub, mais recommandés"
        />
      </div>

      {d.taux_reponse < 70 && d.inscrits > 0 && (
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">
              {100 - d.taux_reponse} % des inscrits n'ont pas de canal enregistré.
            </strong>{" "}
            Il s'agit soit de comptes créés avant la mise en place de la
            question, soit d'un écran passé sans réponse. Les proportions
            ci-dessous ne portent donc que sur une partie des inscrits.
          </p>
        </div>
      )}

      {d.declare.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">
            Aucune donnée disponible sur la période.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[44rem]">
            <thead>
              <tr className="border-b border-border">
                {["Canal", "Inscrits", "Actifs", "Profils", "Matchs", "Payants", "Revenus", "Conversion"]
                  .map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {d.declare.map(c => {
                const m = CANAUX[c.canal] ?? CANAUX.autre;
                const conv = c.inscrits > 0 ? Math.round((c.payants / c.inscrits) * 100) : 0;
                return (
                  <tr key={c.canal} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg grid place-items-center shrink-0 ${m.couleur}`}>
                          <m.icone className="w-3.5 h-3.5" />
                        </span>
                        <span className="font-medium">{m.label}</span>
                      </span>
                      <div className="h-1.5 rounded-full bg-secondary mt-1.5 overflow-hidden max-w-[8rem]">
                        <div className="h-full bg-primary rounded-full"
                             style={{ width: `${(c.inscrits / max) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{c.inscrits}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.actifs}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.profils}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.matchs}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{c.payants}</td>
                    <td className="px-4 py-3 tabular-nums">{formatPrice(c.revenus)}</td>
                    <td className="px-4 py-3">
                      <span className={`tabular-nums font-semibold ${conv >= 5 ? "text-emerald-600" : ""}`}>
                        {conv} %
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mesuré, quand il y en a */}
      {d.mesure.some(m => m.source !== "direct") && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Mesuré dans l'URL
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Paramètre <code>utm_source</code> au moment du clic. Un fait,
              pas une déclaration.
            </p>
            <div className="mt-3 space-y-2">
              {d.mesure.map(m => (
                <div key={m.source} className="flex items-center justify-between text-sm">
                  <span>{m.source}</span>
                  <span className="tabular-nums">
                    <strong>{m.inscrits}</strong>
                    <span className="text-muted-foreground text-xs"> · {m.payants} payant(s)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {d.ecart.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Mesuré contre déclaré</h3>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                L'écart est instructif : une publicité peut déclencher le clic
                d'une personne qu'un ami avait déjà convaincue.
              </p>
              <div className="mt-3 space-y-2">
                {d.ecart.slice(0, 8).map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {e.mesure} → <strong className="text-foreground">
                        {CANAUX[e.declare]?.label ?? e.declare}
                      </strong>
                    </span>
                    <span className="tabular-nums font-semibold">{e.n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Petite({ v, l, alerte }: { v: string; l: string; alerte?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${alerte ? "border-gold/40 bg-gold/5" : "border-border bg-card"}`}>
      <div className="text-2xl font-serif font-bold tabular-nums">{v}</div>
      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{l}</div>
    </div>
  );
}
