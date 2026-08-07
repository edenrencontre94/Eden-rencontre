import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  TrendingUp, Users, Heart, MessageSquare, Wallet, AlertTriangle,
  RefreshCw, Filter, Globe, UserMinus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/plans";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

type Point = { d: string; n: number };

type Analytics = {
  range_days: number;
  from: string;
  to: string;
  signups: Point[];
  matches: Point[];
  messages: Point[];
  revenue: Point[];
  totals: {
    members: number; new_members: number; active_7d: number; active_30d: number;
    paying: number; revenue_total: number; revenue_period: number;
    orders_period: number; pending: number; failed_period: number;
  };
  departures: Point[];
  croissance: {
    inscriptions: number; departs: number; nette: number;
    departs_succes: number; suspendus: number;
  };
  engagement: {
    likes: number; passes: number; superlikes: number; boosts: number;
    publications: number; visites: number;
    taux_reciprocite: number | null; taux_engagement_match: number | null;
    taux_reponse: number | null; messages_par_match: number | null;
    adhesion: number | null;
  };
  experience: {
    sans_like_recu: number; sans_match: number; sans_photo: number;
    completion_moyenne: number | null;
  };
  cohortes: {
    mois: string; inscrits: number; actifs_j7: number;
    actifs_j30: number; retention_j30: number | null;
  }[];
  monetisation: {
    panier_moyen: number; payants_uniques: number; taux_conversion: number;
    taux_reachat: number | null; jours_avant_achat: number | null;
    revenu_boosts: number; revenu_abonnements: number;
    echecs_periode: number; taux_echec: number | null;
  };
  sante: {
    signalements: number; signalements_ouverts: number; blocages: number;
    tickets_ouverts: number; taux_signalement: number | null;
    motifs: Record<string, number>;
  };
  by_offer: { offer_id: string; n: number; revenue: number }[];
  funnel: {
    inscrits: number; ont_photo: number; ont_swipe: number;
    ont_match: number; ont_ecrit: number; ont_paye: number;
  };
  by_country: { k: string; n: number }[];
  by_gender: { k: string; n: number }[];
  by_age: { k: string; n: number }[];
  by_denomination: { k: string; n: number }[];
};

const RANGES = [7, 30, 90] as const;

function AdminAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (d: number) => {
    setLoading(true);
    setError(null);

    const { data: res, error: err } = await supabase.rpc("admin_analytics", { p_days: d });

    if (err || (res as any)?.error) {
      console.error("[admin/analytics]", err ?? res);
      setError("Lecture impossible. La migration 34 a-t-elle été exécutée ?");
      setLoading(false);
      return;
    }

    setData(res as Analytics);
    setLoading(false);
  };

  useEffect(() => { load(days); }, [days]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Croissance, engagement et revenus, calculés en base.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border overflow-hidden">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  days === r ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
                }`}
              >
                {r} j
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days)}
            className="p-2 rounded-xl border border-border bg-card hover:bg-secondary transition-colors"
            aria-label="Actualiser"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-secondary animate-pulse" />)}
          </div>
          <div className="h-64 rounded-2xl bg-secondary animate-pulse" />
        </div>
      ) : data && (
        <>
          {/* Chiffres clés */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={Users} label={`Nouveaux membres (${days} j)`}
              value={String(data.totals.new_members)}
              hint={`${data.totals.members} au total`}
            />
            <Stat
              icon={TrendingUp} label="Actifs sur 7 jours"
              value={String(data.totals.active_7d)}
              hint={data.totals.members > 0
                ? `${Math.round((data.totals.active_7d / data.totals.members) * 100)} % des membres`
                : undefined}
            />
            <Stat
              icon={Wallet} label={`Revenus (${days} j)`}
              value={formatPrice(data.totals.revenue_period)}
              hint={`${data.totals.orders_period} commande(s) · ${formatPrice(data.totals.revenue_total)} au total`}
            />
            <Stat
              icon={Heart} label="Abonnés actifs"
              value={String(data.totals.paying)}
              hint={data.totals.members > 0
                ? `${((data.totals.paying / data.totals.members) * 100).toFixed(1)} % de conversion`
                : undefined}
            />
          </div>

          {(data.totals.pending > 0 || data.totals.failed_period > 0) && (
            <div className="rounded-2xl border border-gold/50 bg-gold/5 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">
                <strong>{data.totals.pending}</strong> paiement(s) encore en attente
                {data.totals.failed_period > 0 && <> et <strong>{data.totals.failed_period}</strong> échec(s) sur la période</>}.
                Un paiement bloqué en « pending » signifie souvent qu'un webhook n'est
                pas arrivé — la fonction <code className="px-1 rounded bg-secondary text-xs">chariow-reconcile</code> existe
                pour ces cas.
              </p>
            </div>
          )}

          {/* ══ Croissance nette ══ */}
          {/* Sans la soustraction des départs, 100 inscriptions pour
              90 suppressions ressemble à une croissance de 100. */}
          <Section titre="Croissance" sousTitre={`Sur ${days} jours`}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metrique label="Inscriptions" valeur={data.croissance.inscriptions} />
              <Metrique label="Départs" valeur={data.croissance.departs}
                        detail={data.croissance.departs_succes > 0
                          ? `dont ${data.croissance.departs_succes} ont rencontré quelqu'un`
                          : undefined} />
              <Metrique
                label="Croissance nette"
                valeur={data.croissance.nette}
                ton={data.croissance.nette > 0 ? "bon" : data.croissance.nette < 0 ? "mauvais" : undefined}
                prefixe={data.croissance.nette > 0 ? "+" : ""}
              />
              <Metrique label="Comptes suspendus" valeur={data.croissance.suspendus}
                        ton={data.croissance.suspendus > 0 ? "alerte" : undefined} />
            </div>
          </Section>

          {/* ══ Engagement ══ */}
          <Section
            titre="Engagement"
            sousTitre="Les taux disent ce que les volumes cachent : un million de likes sans réponse ne vaut rien."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metrique
                label="Réciprocité"
                valeur={data.engagement.taux_reciprocite}
                suffixe=" %"
                detail="Part des likes devenus matchs"
                ton={seuil(data.engagement.taux_reciprocite, 10, 4)}
              />
              <Metrique
                label="Matchs engagés"
                valeur={data.engagement.taux_engagement_match}
                suffixe=" %"
                detail="Au moins un message envoyé"
                ton={seuil(data.engagement.taux_engagement_match, 50, 25)}
              />
              <Metrique
                label="Conversations réciproques"
                valeur={data.engagement.taux_reponse}
                suffixe=" %"
                detail="Les deux ont écrit"
                ton={seuil(data.engagement.taux_reponse, 60, 30)}
              />
              <Metrique
                label="Adhésion quotidienne"
                valeur={data.engagement.adhesion}
                suffixe=" %"
                detail="Actifs du jour / du mois"
                ton={seuil(data.engagement.adhesion, 20, 8)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 mt-4">
              <Petit label="Likes" valeur={data.engagement.likes} />
              <Petit label="Passes" valeur={data.engagement.passes} />
              <Petit label="Super Likes" valeur={data.engagement.superlikes} />
              <Petit label="Boosts" valeur={data.engagement.boosts} />
              <Petit label="Publications" valeur={data.engagement.publications} />
              <Petit label="Msgs / match" valeur={data.engagement.messages_par_match} />
            </div>
          </Section>

          {/* ══ Ceux pour qui rien ne se passe ══ */}
          {/* Les moyennes les masquent. Ce sont pourtant eux qui partent. */}
          <Section
            titre="Expérience"
            sousTitre="Les moyennes masquent ceux pour qui rien ne se passe — or ce sont eux qui s'en vont."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metrique
                label="Sans photo"
                valeur={data.experience.sans_photo}
                detail={part(data.experience.sans_photo, data.totals.members)}
                ton={data.experience.sans_photo > 0 ? "alerte" : undefined}
              />
              <Metrique
                label="Aucun like reçu"
                valeur={data.experience.sans_like_recu}
                detail={part(data.experience.sans_like_recu, data.totals.members)}
              />
              <Metrique
                label="Aucun match"
                valeur={data.experience.sans_match}
                detail={part(data.experience.sans_match, data.totals.members)}
              />
              <Metrique
                label="Profil complété"
                valeur={data.experience.completion_moyenne}
                suffixe=" %"
                detail="Moyenne des 500 derniers inscrits"
                ton={seuil(data.experience.completion_moyenne, 70, 40)}
              />
            </div>
          </Section>

          {/* ══ Monétisation ══ */}
          <Section titre="Monétisation">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metrique
                label="Taux de conversion"
                valeur={data.monetisation.taux_conversion}
                suffixe=" %"
                detail={`${data.monetisation.payants_uniques} membre(s) ont payé`}
              />
              <Metrique
                label="Panier moyen"
                texte={formatPrice(data.monetisation.panier_moyen)}
              />
              {/* On ne renouvelle que si le service a tenu sa promesse. */}
              <Metrique
                label="Taux de réachat"
                valeur={data.monetisation.taux_reachat}
                suffixe=" %"
                detail="Ont payé au moins deux fois"
                ton={seuil(data.monetisation.taux_reachat, 25, 10)}
              />
              <Metrique
                label="Délai avant achat"
                valeur={data.monetisation.jours_avant_achat}
                suffixe=" j"
                detail="Médiane depuis l'inscription"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mt-4">
              <Petit label="Revenus abonnements"
                     texte={formatPrice(data.monetisation.revenu_abonnements)} />
              <Petit label="Revenus Boosts"
                     texte={formatPrice(data.monetisation.revenu_boosts)} />
              <Petit label="Taux d'échec de paiement"
                     valeur={data.monetisation.taux_echec} suffixe=" %" />
            </div>
          </Section>

          {/* ══ Rétention par cohorte ══ */}
          {data.cohortes.length > 0 && (
            <Section
              titre="Rétention par cohorte"
              sousTitre="Une moyenne globale mélange anciens et nouveaux. Par mois d'arrivée, on voit si l'accueil s'améliore."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2">Cohorte</th>
                      <th className="pb-2 text-right">Inscrits</th>
                      <th className="pb-2 text-right">Actifs à 7 j</th>
                      <th className="pb-2 text-right">Actifs à 30 j</th>
                      <th className="pb-2 text-right">Rétention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohortes.map(c => (
                      <tr key={c.mois} className="border-t border-border/60">
                        <td className="py-2.5 font-medium">
                          {new Date(c.mois + "-01").toLocaleDateString("fr-FR", {
                            month: "long", year: "numeric",
                          })}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{c.inscrits}</td>
                        <td className="py-2.5 text-right tabular-nums">{c.actifs_j7}</td>
                        <td className="py-2.5 text-right tabular-nums">{c.actifs_j30}</td>
                        <td className={`py-2.5 text-right tabular-nums font-semibold ${
                          c.retention_j30 === null ? "text-muted-foreground"
                            : c.retention_j30 >= 40 ? "text-emerald-600"
                            : c.retention_j30 >= 20 ? "text-gold" : "text-destructive"
                        }`}>
                          {c.retention_j30 === null ? "—" : `${c.retention_j30} %`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ══ Santé ══ */}
          <Section titre="Sécurité et modération">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metrique label="Signalements" valeur={data.sante.signalements}
                        detail={`${data.sante.signalements_ouverts} en attente`}
                        ton={data.sante.signalements_ouverts > 0 ? "alerte" : undefined} />
              <Metrique label="Blocages" valeur={data.sante.blocages} />
              {/* Le chiffre brut monte avec la croissance ; ce ratio non. */}
              <Metrique label="Taux de signalement"
                        valeur={data.sante.taux_signalement} suffixe=" %"
                        detail="Rapporté aux membres actifs" />
              <Metrique label="Tickets ouverts" valeur={data.sante.tickets_ouverts}
                        ton={data.sante.tickets_ouverts > 0 ? "alerte" : undefined} />
            </div>
          </Section>

          {/* Courbes */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart title="Inscriptions" points={data.signups} color="hsl(var(--primary))" icon={Users} />
            <Chart title="Revenus" points={data.revenue} color="hsl(var(--gold))" icon={Wallet} money />
            <Chart title="Matchs" points={data.matches} color="hsl(var(--primary))" icon={Heart} />
            <Chart title="Messages" points={data.messages} color="hsl(var(--primary))" icon={MessageSquare} />
            <Chart title="Départs" points={data.departures} color="hsl(var(--destructive))" icon={UserMinus} />
          </div>

          {/* Entonnoir */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" /> Entonnoir de conversion
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Nombre de membres <strong className="text-foreground">distincts</strong> ayant
              franchi chaque étape, depuis le lancement.
            </p>

            <div className="mt-5 space-y-2.5">
              {[
                { label: "Ont créé un compte", n: data.funnel.inscrits },
                // Ajouté : c'est souvent LE décrochage majeur, et il est
                // réparable — un profil sans photo ne reçoit rien.
                { label: "Ont ajouté une photo", n: data.funnel.ont_photo },
                { label: "Ont commencé à découvrir", n: data.funnel.ont_swipe },
                { label: "Ont obtenu un match", n: data.funnel.ont_match },
                { label: "Ont écrit un message", n: data.funnel.ont_ecrit },
                { label: "Ont payé", n: data.funnel.ont_paye },
              ].map((step, i, arr) => {
                const base = arr[0].n || 1;
                const pct = (step.n / base) * 100;
                const prev = i > 0 ? arr[i - 1].n : null;
                const drop = prev && prev > 0 ? Math.round((1 - step.n / prev) * 100) : 0;
                return (
                  <div key={step.label}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{step.label}</span>
                      <span className="tabular-nums">
                        <strong>{step.n}</strong>
                        <span className="text-muted-foreground ml-2 text-xs">{pct.toFixed(0)} %</span>
                      </span>
                    </div>
                    <div className="mt-1 h-3 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    {i > 0 && drop > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        −{drop} % par rapport à l'étape précédente
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Ventes par offre */}
          {data.by_offer.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-serif text-lg font-semibold">Ventes par offre</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2">Offre</th>
                      <th className="pb-2 text-right">Ventes</th>
                      <th className="pb-2 text-right">Revenus</th>
                      <th className="pb-2 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_offer.map(o => {
                      const total = data.by_offer.reduce((s, x) => s + Number(x.revenue), 0) || 1;
                      return (
                        <tr key={o.offer_id} className="border-t border-border/60">
                          <td className="py-2.5 font-medium">{OFFER_LABELS[o.offer_id] ?? o.offer_id}</td>
                          <td className="py-2.5 text-right tabular-nums">{o.n}</td>
                          <td className="py-2.5 text-right tabular-nums">{formatPrice(Number(o.revenue))}</td>
                          <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                            {Math.round((Number(o.revenue) / total) * 100)} %
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Répartitions */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Breakdown title="Pays" icon={Globe} rows={data.by_country} />
            <Breakdown title="Genre" icon={Users} rows={data.by_gender} labels={GENDER_LABELS} />
            <Breakdown title="Tranches d'âge" icon={Users} rows={data.by_age} />
            <Breakdown title="Confession" icon={Users} rows={data.by_denomination} />
          </div>
        </>
      )}
    </div>
  );
}

const OFFER_LABELS: Record<string, string> = {
  premium_15j: "Premium — 15 jours",
  premium_1m: "Premium — 1 mois",
  premium_3m: "Premium — 3 mois",
  vip_1m: "VIP — 1 mois",
  boost_24h: "Boost 24 h",
  boost_3j: "Boost 3 jours",
  boost_7j: "Boost 7 jours",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Hommes",
  female: "Femmes",
};

/**
 * Graphique en aires, dessiné en SVG.
 *
 * Aucune bibliothèque : quelques `path` suffisent, et on évite d'alourdir
 * un back-office consulté par une poignée de personnes.
 */
function Chart({ title, points, color, icon: Icon, money }: {
  title: string; points: Point[]; color: string; icon: any; money?: boolean;
}) {
  const values = points.map(p => Number(p.n) || 0);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const W = 100;
  const H = 32;

  const coords = values.map((v, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * W : W / 2;
    const y = H - (v / max) * H;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = coords.length ? `M ${coords.join(" L ")}` : "";
  const area = coords.length ? `${line} L ${W},${H} L 0,${H} Z` : "";

  // Comparaison première moitié / seconde moitié : plus honnête qu'un
  // écart entre le premier et le dernier jour, qu'un seul pic suffirait
  // à rendre spectaculaire.
  const half = Math.floor(values.length / 2);
  const a = values.slice(0, half).reduce((x, y) => x + y, 0);
  const b = values.slice(half).reduce((x, y) => x + y, 0);
  const trend = a > 0 ? Math.round(((b - a) / a) * 100) : (b > 0 ? 100 : 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif font-semibold flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" /> {title}
          </h3>
          <div className="mt-1.5 text-2xl font-serif font-bold">
            {money ? formatPrice(total) : total}
          </div>
        </div>
        {values.length > 3 && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            trend > 0 ? "bg-emerald-500/15 text-emerald-600"
              : trend < 0 ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-muted-foreground"
          }`}>
            {trend > 0 ? "+" : ""}{trend} %
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-4 w-full h-24">
        <path d={area} fill={color} opacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
        <span>{fmtDay(points[0]?.d)}</span>
        <span>{fmtDay(points[points.length - 1]?.d)}</span>
      </div>
    </section>
  );
}

function Breakdown({ title, icon: Icon, rows, labels }: {
  title: string; icon: any; rows: { k: string; n: number }[]; labels?: Record<string, string>;
}) {
  const max = Math.max(...rows.map(r => Number(r.n)), 1);
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-serif font-semibold flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h3>
      <div className="mt-4 space-y-2.5">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée.</p>}
        {rows.map(r => (
          <div key={r.k} className="flex items-center gap-3">
            <span className="text-sm w-28 shrink-0 truncate">{labels?.[r.k] ?? r.k}</span>
            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${(Number(r.n) / max) * 100}%` }} />
            </div>
            <span className="text-sm font-semibold w-10 text-right tabular-nums">{r.n}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Éléments des nouvelles sections ─────────────────────────────────────────

function Section({ titre, sousTitre, children }: {
  titre: string; sousTitre?: string; children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-serif text-lg font-semibold">{titre}</h2>
      {sousTitre && (
        <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-2xl leading-relaxed">
          {sousTitre}
        </p>
      )}
      <div className={sousTitre ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

/**
 * Couleur d'un taux selon deux seuils.
 *
 * Les repères sont indicatifs, pas des vérités : ils servent à repérer
 * une dégradation d'un mois sur l'autre, pas à décerner une note.
 */
function seuil(v: number | null, bon: number, mauvais: number):
  "bon" | "alerte" | "mauvais" | undefined {
  if (v === null || v === undefined) return undefined;
  if (v >= bon) return "bon";
  if (v <= mauvais) return "mauvais";
  return "alerte";
}

function part(n: number, total: number): string | undefined {
  if (!total) return undefined;
  return `${Math.round((n / total) * 100)} % des membres`;
}

function Metrique({ label, valeur, texte, suffixe, prefixe, detail, ton }: {
  label: string;
  valeur?: number | null;
  texte?: string;
  suffixe?: string; prefixe?: string; detail?: string;
  ton?: "bon" | "alerte" | "mauvais";
}) {
  // Une valeur absente s'affiche « — » : mieux vaut l'avouer qu'afficher
  // un zéro qui se lirait comme une mesure.
  const affiche = texte ?? (valeur === null || valeur === undefined
    ? "—"
    : `${prefixe ?? ""}${valeur}${suffixe ?? ""}`);

  const couleur = ton === "bon" ? "text-emerald-600"
    : ton === "mauvais" ? "text-destructive"
    : ton === "alerte" ? "text-gold" : "";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`text-2xl font-serif font-bold ${couleur}`}>{affiche}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {detail && <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{detail}</div>}
    </div>
  );
}

function Petit({ label, valeur, texte, suffixe }: {
  label: string; valeur?: number | null; texte?: string; suffixe?: string;
}) {
  const affiche = texte ?? (valeur === null || valeur === undefined
    ? "—" : `${valeur}${suffixe ?? ""}`);
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <div className="text-lg font-serif font-bold">{affiche}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: {
  icon: any; label: string; value: string; hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="w-5 h-5 text-primary" />
      <div className="text-2xl font-serif font-bold mt-2">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function fmtDay(d?: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
