import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Megaphone, Send, Users, MailCheck, AlertTriangle, Loader2,
  RefreshCw, Ban, Activity, Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/auth";

export const Route = createFileRoute("/admin/marketing")({
  component: AdminMarketing,
});

/**
 * Marketing e-mail, adossé au socle de la Phase 0.
 *
 * Cette page proposait des « notifications push » et des codes promo — deux
 * mécanismes qui n'existent nulle part dans le projet — avec des compteurs
 * d'utilisation inventés. Elle s'appuie désormais sur ce qui existe
 * réellement : `email_preferences` pour le consentement, `email_log` pour
 * l'historique, `email_suppression` pour la santé du domaine.
 */

type Stats = {
  total_members: number;
  opted_in_marketing: number;
  opted_in_matches: number;
  opted_in_messages: number;
  suppressed: number;
  bounces: number;
  complaints: number;
  sent_total: number;
  sent_7d: number;
  sent_30d: number;
  by_category: Record<string, number>;
};

type Campaign = {
  id: string;
  subject: string;
  body: string;
  status: string;
  recipients: number;
  delivered: number;
  skipped: number;
  created_at: string;
  sent_at: string | null;
};

function AdminMarketing() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);

    const [{ data: s, error: sErr }, { data: c }] = await Promise.all([
      supabase.rpc("admin_email_stats"),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    if (sErr || (s as any)?.error) {
      console.error("[admin/marketing]", sErr ?? s);
      setError(
        "Lecture impossible. La migration 32 a-t-elle été exécutée, et votre compte a-t-il bien le rôle administrateur ?",
      );
      setLoading(false);
      return;
    }

    setStats(s as Stats);
    setCampaigns((c ?? []) as Campaign[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Un objet et un message sont nécessaires");
      return;
    }
    if (!stats || stats.opted_in_marketing === 0) {
      toast.error("Aucun membre n'a consenti à recevoir des e-mails marketing");
      return;
    }

    const ok = window.confirm(
      `Envoyer « ${subject.trim()} » à ${stats.opted_in_marketing} membre(s) ayant consenti ?\n\n` +
      `Un envoi ne peut pas être annulé.`,
    );
    if (!ok) return;

    setSending(true);
    try {
      const userId = await getCurrentUserId();

      const { data: campaign, error: cErr } = await supabase
        .from("campaigns")
        .insert({ subject: subject.trim(), body: body.trim(), created_by: userId })
        .select()
        .single();

      if (cErr || !campaign) throw cErr ?? new Error("Création de la campagne impossible");

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ campaignId: campaign.id }),
        },
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "L'envoi a échoué");

      toast.success(`Campagne envoyée à ${json.delivered} membre(s)`, {
        description: json.skipped > 0
          ? `${json.skipped} ignoré(s) — désabonnés, adresses écartées ou plafond atteint`
          : undefined,
      });
      setSubject("");
      setBody("");
      load();
    } catch (e: any) {
      console.error("[admin/marketing] envoi:", e);
      toast.error(e?.message ?? "L'envoi a échoué");
    } finally {
      setSending(false);
    }
  };

  const complaintRate = stats && stats.sent_total > 0
    ? (stats.complaints / stats.sent_total) * 100
    : 0;
  const optInRate = stats && stats.total_members > 0
    ? Math.round((stats.opted_in_marketing / stats.total_members) * 100)
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold">Marketing</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Campagnes e-mail, consentements et santé du domaine d'envoi.
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm hover:bg-secondary transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : stats && (
        <>
          {/* Audience */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Users} label="Membres au total" value={String(stats.total_members)} />
            <Stat
              icon={MailCheck}
              label="Consentement marketing"
              value={String(stats.opted_in_marketing)}
              hint={stats.total_members > 0 ? `${optInRate} % des membres` : undefined}
            />
            <Stat
              icon={Send}
              label="E-mails envoyés (30 j)"
              value={String(stats.sent_30d)}
              hint={`${stats.sent_7d} sur 7 jours · ${stats.sent_total} au total`}
            />
            <Stat
              icon={Ban}
              label="Adresses écartées"
              value={String(stats.suppressed)}
              hint={`${stats.bounces} rebond(s) · ${stats.complaints} plainte(s)`}
              warn={stats.suppressed > 0}
            />
          </div>

          {/* Santé du domaine : l'indicateur qui compte vraiment */}
          <section className={`rounded-2xl border p-5 ${
            complaintRate > 0.3 ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"
          }`}>
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Santé du domaine d'envoi
            </h2>

            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <div className={`text-3xl font-serif font-bold ${complaintRate > 0.3 ? "text-destructive" : ""}`}>
                  {complaintRate.toFixed(2)} %
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Taux de plainte</div>
              </div>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Gmail impose de rester <strong className="text-foreground">sous 0,30 %</strong>.
                Au-delà, le domaine est déclassé — et vos e-mails de confirmation
                d'inscription cessent d'arriver, puisqu'ils partent de la même adresse.
              </p>
            </div>

            {complaintRate > 0.3 && (
              <p className="mt-4 text-sm text-destructive">
                Seuil dépassé. Espacez les envois et revoyez la pertinence des contenus
                avant toute nouvelle campagne.
              </p>
            )}

            <div className="mt-5 pt-4 border-t border-border/60 grid gap-3 sm:grid-cols-3 text-sm">
              <Consent label="Nouveaux matchs" n={stats.opted_in_matches} total={stats.total_members} />
              <Consent label="Messages reçus" n={stats.opted_in_messages} total={stats.total_members} />
              <Consent label="Actualités" n={stats.opted_in_marketing} total={stats.total_members} />
            </div>
          </section>

          {/* Répartition par catégorie */}
          {Object.keys(stats.by_category ?? {}).length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-serif text-lg font-semibold">Ce qui a été envoyé</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Répartition de tous les e-mails journalisés, par catégorie.
              </p>
              <div className="mt-4 space-y-2.5">
                {Object.entries(stats.by_category)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, n]) => {
                    const max = Math.max(...Object.values(stats.by_category));
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-sm w-32 shrink-0 capitalize truncate">{cat}</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${max > 0 ? (n / max) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold w-10 text-right">{n}</span>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Nouvelle campagne */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" /> Nouvelle campagne
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Objet
                </label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Ex : trois conseils pour un profil qui inspire confiance"
                  maxLength={120}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {subject.length}/120 — un objet clair et concret ouvre mieux qu'une promesse vague.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Message
                </label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={7}
                  placeholder={"Bonjour {{prenom}},\n\nUne ligne par paragraphe."}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  <code className="px-1 rounded bg-secondary">{"{{prenom}}"}</code> est remplacé
                  par le prénom du destinataire. Chaque ligne devient un paragraphe.
                </p>
              </div>

              {(subject.trim() || body.trim()) && (
                <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Aperçu
                  </p>
                  <p className="font-semibold text-sm">{subject || "Objet de l'e-mail"}</p>
                  <div className="mt-2 space-y-1.5">
                    {(body || "Corps du message…").split("\n").filter(l => l.trim()).map((l, i) => (
                      <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                        {l.replace(/\{\{prenom\}\}/g, "Marie")}
                      </p>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/60">
                    Se désabonner — ajouté automatiquement à chaque envoi.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Destinataires : <strong className="text-foreground">{stats.opted_in_marketing}</strong> membre(s)
                  ayant explicitement consenti.
                </p>
                <button
                  onClick={send}
                  disabled={sending || !subject.trim() || !body.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-soft hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Envoi en cours…" : "Envoyer la campagne"}
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-secondary/60 p-3.5 flex gap-2.5">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Seuls les membres ayant coché « Actualités et conseils » recevront ce message.
                Le lien de désabonnement en un clic est ajouté automatiquement, et les adresses
                en rebond ou ayant porté plainte sont écartées. Ces règles s'appliquent côté
                serveur : elles ne sont pas contournables depuis cette page, volontairement.
              </p>
            </div>
          </section>

          {/* Historique */}
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-serif text-lg font-semibold">Campagnes envoyées</h2>
            </div>

            {campaigns.length === 0 ? (
              <p className="p-8 text-sm text-muted-foreground text-center">
                Aucune campagne pour l'instant.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {campaigns.map(c => (
                  <div key={c.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{c.subject}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(c.sent_at ?? c.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "long", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">{c.delivered}</strong> envoyés
                      </span>
                      {c.skipped > 0 && (
                        <span className="text-xs text-muted-foreground">{c.skipped} ignorés</span>
                      )}
                      <CampaignStatus status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Les notifications push et les codes promotionnels ne figurent pas ici : ces
            mécanismes n'existent pas dans l'application. Les afficher donnerait l'illusion
            de fonctionnalités disponibles — et les réductions se gèrent de toute façon
            sur Chariow, où les paiements sont réellement encaissés.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, warn }: {
  icon: any; label: string; value: string; hint?: string; warn?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${warn ? "border-gold/50 bg-gold/5" : "border-border bg-card"}`}>
      <Icon className={`w-5 h-5 ${warn ? "text-gold" : "text-primary"}`} />
      <div className="text-2xl font-serif font-bold mt-2">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Consent({ label, n, total }: { label: string; n: number; total: number }) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold">{pct} %</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CampaignStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Brouillon", cls: "bg-secondary text-muted-foreground" },
    sending: { label: "En cours", cls: "bg-gold/20 text-gold" },
    sent: { label: "Envoyée", cls: "bg-emerald-500/15 text-emerald-600" },
    failed: { label: "Échouée", cls: "bg-destructive/10 text-destructive" },
  };
  const s = map[status] ?? { label: status, cls: "bg-secondary text-muted-foreground" };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}
