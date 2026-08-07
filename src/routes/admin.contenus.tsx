import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileText, ShieldCheck, MessagesSquare, Plus, Trash2, Eye, EyeOff,
  Loader2, AlertTriangle, RefreshCw, Check, X, Lock, ArrowLeft, Save, Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import { invalidateSettings } from "@/lib/appSettings";

export const Route = createFileRoute("/admin/contenus")({
  component: AdminContenus,
});

const TABS = [
  { key: "blog", label: "Blog", icon: FileText },
  { key: "moderation", label: "Publications", icon: ShieldCheck },
  { key: "conversations", label: "Conversations", icon: MessagesSquare },
] as const;

function AdminContenus() {
  const [tab, setTab] = useState<string>("blog");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold">Gestion de contenus</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Articles de blog, approbation des publications et conversations privées.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "blog" && <BlogTab />}
      {tab === "moderation" && <ModerationTab />}
      {tab === "conversations" && <ConversationsTab />}
    </div>
  );
}

// ─── Blog ────────────────────────────────────────────────────────────────────

type Post = {
  id: string; slug: string; title: string; meta_description: string | null;
  excerpt: string | null; category: string; intro: string | null;
  sections: { heading: string; body: string[] }[];
  conclusion: string | null; status: string; published_at: string | null;
};

const VIDE: Omit<Post, "id"> = {
  slug: "", title: "", meta_description: "", excerpt: "", category: "Conseil",
  intro: "", sections: [{ heading: "", body: [""] }], conclusion: "",
  status: "draft", published_at: null,
};

function BlogTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [edit, setEdit] = useState<Partial<Post> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error: err } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (err) {
      console.error("[admin/contenus] blog:", err);
      setError("Lecture impossible. La migration 47 a-t-elle été exécutée ?");
      setLoading(false);
      return;
    }
    setPosts((data ?? []) as Post[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.title || edit.title.trim().length < 5) {
      toast.error("Le titre doit faire au moins 5 caractères");
      return;
    }
    const slug = (edit.slug || "").trim() || slugify(edit.title);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      toast.error("L'adresse ne peut contenir que des minuscules, chiffres et tirets");
      return;
    }

    setSaving(true);
    const userId = await getCurrentUserId();
    const payload = {
      slug,
      title: edit.title.trim(),
      meta_description: edit.meta_description?.trim() || null,
      excerpt: edit.excerpt?.trim() || null,
      category: edit.category || "Conseil",
      intro: edit.intro?.trim() || null,
      // Les sections vides sont écartées avant l'envoi : elles produiraient
      // des titres orphelins dans l'article publié.
      sections: (edit.sections ?? []).filter(
        s => s.heading.trim() || s.body.some(b => b.trim()),
      ).map(s => ({ heading: s.heading.trim(), body: s.body.filter(b => b.trim()) })),
      conclusion: edit.conclusion?.trim() || null,
      status: edit.status || "draft",
      author_id: userId,
    };

    const { error: err } = edit.id
      ? await supabase.from("blog_posts").update(payload).eq("id", edit.id)
      : await supabase.from("blog_posts").insert(payload);

    setSaving(false);
    if (err) {
      console.error(err);
      toast.error(err.code === "23505" ? "Cette adresse est déjà utilisée" : "Enregistrement impossible");
      return;
    }
    toast.success(payload.status === "published" ? "Article publié" : "Brouillon enregistré");
    setEdit(null);
    load();
  };

  const remove = async (p: Post) => {
    if (!confirm(`Supprimer « ${p.title} » ?`)) return;
    const { error: err } = await supabase.from("blog_posts").delete().eq("id", p.id);
    if (err) { toast.error("Suppression impossible"); return; }
    setPosts(prev => prev.filter(x => x.id !== p.id));
    toast.success("Article supprimé");
  };

  if (error) return <Erreur message={error} />;

  // ── Éditeur ──
  if (edit) {
    const sections = edit.sections ?? [];
    const setSections = (s: typeof sections) => setEdit({ ...edit, sections: s });

    return (
      <div className="space-y-5">
        <button
          onClick={() => setEdit(null)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Retour aux articles
        </button>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <Champ label="Titre">
            <input
              value={edit.title ?? ""}
              onChange={e => setEdit({ ...edit, title: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm"
            />
          </Champ>

          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Adresse (URL)" hint="Laissez vide pour la générer depuis le titre">
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground shrink-0">/blog/</span>
                <input
                  value={edit.slug ?? ""}
                  onChange={e => setEdit({ ...edit, slug: e.target.value })}
                  placeholder={edit.title ? slugify(edit.title) : "mon-article"}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-background border border-border"
                />
              </div>
            </Champ>

            <Champ label="Catégorie">
              <input
                value={edit.category ?? ""}
                onChange={e => setEdit({ ...edit, category: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm"
              />
            </Champ>
          </div>

          <Champ
            label="Description pour les moteurs de recherche"
            hint="C'est le texte affiché sous le titre dans Google. 150 à 160 caractères."
          >
            <textarea
              value={edit.meta_description ?? ""}
              onChange={e => setEdit({ ...edit, meta_description: e.target.value })}
              rows={2}
              maxLength={300}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm resize-y"
            />
            <p className={`text-[11px] mt-1 ${
              (edit.meta_description?.length ?? 0) > 160 ? "text-gold" : "text-muted-foreground"
            }`}>
              {edit.meta_description?.length ?? 0} caractères
              {(edit.meta_description?.length ?? 0) > 160 && " — Google tronquera au-delà de 160"}
            </p>
          </Champ>

          <Champ label="Accroche" hint="Affichée dans la liste des articles">
            <textarea
              value={edit.excerpt ?? ""}
              onChange={e => setEdit({ ...edit, excerpt: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm resize-y"
            />
          </Champ>

          <Champ label="Introduction">
            <textarea
              value={edit.intro ?? ""}
              onChange={e => setEdit({ ...edit, intro: e.target.value })}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm resize-y"
            />
          </Champ>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <input
                  value={s.heading}
                  onChange={e => {
                    const n = [...sections];
                    n[i] = { ...s, heading: e.target.value };
                    setSections(n);
                  }}
                  placeholder={`Titre de la section ${i + 1}`}
                  className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm font-semibold"
                />
                <button
                  onClick={() => setSections(sections.filter((_, j) => j !== i))}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={s.body.join("\n\n")}
                onChange={e => {
                  const n = [...sections];
                  // Une ligne vide sépare les paragraphes — la convention
                  // d'écriture la plus naturelle, et la seule qui survive
                  // à un copier-coller depuis un traitement de texte.
                  n[i] = { ...s, body: e.target.value.split(/\n\s*\n/) };
                  setSections(n);
                }}
                rows={5}
                placeholder="Séparez les paragraphes par une ligne vide."
                className="mt-2 w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm resize-y"
              />
            </div>
          ))}

          <button
            onClick={() => setSections([...sections, { heading: "", body: [""] }])}
            className="w-full py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 hover:text-primary"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Ajouter une section
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <Champ label="Conclusion">
            <textarea
              value={edit.conclusion ?? ""}
              onChange={e => setEdit({ ...edit, conclusion: e.target.value })}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm resize-y"
            />
          </Champ>
        </div>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border py-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Switch
              checked={edit.status === "published"}
              onCheckedChange={v => setEdit({ ...edit, status: v ? "published" : "draft" })}
            />
            <span className="text-sm font-medium">
              {edit.status === "published" ? "Publié — visible de tous" : "Brouillon"}
            </span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={() => setEdit(null)}
              className="px-4 py-2 rounded-xl border border-border text-sm"
            >
              Annuler
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Liste ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {posts.length} article(s) · {posts.filter(p => p.status === "published").length} publié(s)
        </p>
        <button
          onClick={() => setEdit({ ...VIDE })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Nouvel article
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-secondary animate-pulse" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">
            Aucun article en base. Les quatre articles existants restent servis
            depuis le code — ils continuent de fonctionner.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {posts.map(p => (
            <div key={p.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setEdit(p)} className="min-w-0 flex-1 text-left">
                <p className="font-medium text-sm truncate">{p.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  /blog/{p.slug} · {p.category}
                  {p.published_at && ` · ${new Date(p.published_at).toLocaleDateString("fr-FR")}`}
                </p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  p.status === "published"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-secondary text-muted-foreground"
                }`}>
                  {p.status === "published" ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {p.status === "published" ? "Publié" : "Brouillon"}
                </span>
                <button
                  onClick={() => remove(p)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Approbation des publications ────────────────────────────────────────────

function ModerationTab() {
  const [data, setData] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [{ data: d, error: err }, { data: r }] = await Promise.all([
      supabase.rpc("admin_pending_posts", { p_limit: 100 }),
      supabase.rpc("admin_post_reports", { p_limit: 100 }),
    ]);

    if (err || (d as any)?.error) {
      setError("Lecture impossible. Les migrations 47 et 48 ont-elles été exécutées ?");
      setLoading(false);
      return;
    }
    setData(d);
    if (r && !(r as any).error) setReports(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const traiter = async (id: string, action: "dismiss" | "hide" | "delete") => {
    const libelle = action === "dismiss" ? "écarter ce signalement"
      : action === "hide" ? "retirer cette publication du fil"
      : "supprimer définitivement cette publication";
    if (!confirm(`Confirmer : ${libelle} ?`)) return;

    setBusy(id);
    const { data: res, error: err } = await supabase.rpc("admin_review_post_report", {
      p_report_id: id, p_action: action,
    });
    setBusy(null);

    if (err || !(res as any)?.ok) { toast.error("L'opération a échoué"); return; }

    // Tous les signalements de la même publication sont clos ensemble en
    // base : la liste locale doit refléter cela, sinon les doublons
    // resteraient affichés jusqu'au rechargement.
    const traite = reports.signalements.find((s: any) => s.id === id);
    setReports((r: any) => ({
      ...r,
      signalements: r.signalements.filter((s: any) => s.post?.id !== traite?.post?.id),
    }));
    toast.success(
      action === "dismiss" ? "Signalement écarté"
        : action === "hide" ? "Publication retirée du fil"
        : "Publication supprimée",
    );
  };

  const toggleModeration = async (actif: boolean) => {
    const { error: err } = await supabase
      .from("app_settings")
      .update({ value: actif, updated_at: new Date().toISOString() })
      .eq("key", "community_moderation");

    if (err) { toast.error("Réglage impossible"); return; }
    invalidateSettings();
    setData((d: any) => ({ ...d, moderation_active: actif }));
    toast.success(actif
      ? "Les nouvelles publications passeront par vous"
      : "Les publications paraissent désormais immédiatement");
  };

  const review = async (id: string, approve: boolean) => {
    let reason: string | null = null;
    if (!approve) {
      reason = prompt("Motif du refus (visible dans le journal) :");
      if (!reason || reason.trim().length < 5) {
        toast.error("Un motif d'au moins 5 caractères est requis");
        return;
      }
    }
    setBusy(id);
    const { data: res, error: err } = await supabase.rpc("admin_review_post", {
      p_post_id: id, p_approve: approve, p_reason: reason,
    });
    setBusy(null);

    if (err || !(res as any)?.ok) { toast.error("L'opération a échoué"); return; }
    setData((d: any) => ({
      ...d,
      posts: d.posts.filter((p: any) => p.id !== id),
      en_attente: Math.max(0, d.en_attente - 1),
    }));
    toast.success(approve ? "Publication approuvée" : "Publication refusée");
  };

  if (error) return <Erreur message={error} />;
  if (loading) return <div className="h-40 rounded-2xl bg-secondary animate-pulse" />;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Approbation avant affichage</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Activé, chaque publication attend votre validation. C'est tenable
              tant que le volume l'est — au-delà, une file non traitée fait plus
              de tort qu'une modération a posteriori : les membres publient dans
              le vide et cessent de publier.
            </p>
          </div>
          <Switch
            checked={data?.moderation_active === true}
            onCheckedChange={toggleModeration}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Signalées" value={reports?.en_attente ?? 0}
              warn={(reports?.en_attente ?? 0) > 0} />
        <Stat label="En attente" value={data?.en_attente ?? 0} warn={(data?.en_attente ?? 0) > 0} />
        <Stat label="Refusées" value={data?.rejetes ?? 0} />
      </div>

      {/* ── Signalements ──────────────────────────────────────────
          Placés AVANT la file d'approbation : une publication déjà en
          ligne et signalée fait du tort maintenant, alors qu'une
          publication en attente n'est vue de personne. */}
      {(reports?.signalements ?? []).length > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Publications signalées
          </h3>

          <div className="space-y-3">
            {reports.signalements.map((s: any) => (
              <div key={s.id} className="rounded-2xl border border-destructive/30 bg-destructive/5 overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-[11px] font-semibold">
                      {s.reason}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Signalé par {s.signalant} · {new Date(s.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>

                  {/* Plusieurs signalements sur la même publication : c'est
                      le signal le plus fort, il doit sauter aux yeux. */}
                  {s.nb_signalements > 1 && (
                    <p className="text-xs font-semibold text-destructive mt-2">
                      {s.nb_signalements} signalements sur cette publication
                    </p>
                  )}

                  {!s.post?.id ? (
                    <p className="text-sm text-muted-foreground italic mt-3">
                      La publication a déjà été supprimée.
                    </p>
                  ) : (
                    <div className="mt-3 rounded-xl bg-card border border-border p-3">
                      <p className="text-[11px] text-muted-foreground">
                        {s.post.auteur} · {s.post.category}
                        {s.post.status === "rejected" && " · déjà retirée du fil"}
                      </p>
                      <p className="text-sm mt-1.5 leading-relaxed whitespace-pre-line">
                        {s.post.text}
                      </p>
                      {s.post.image_url && (
                        <img src={s.post.image_url} alt="" className="mt-2 rounded-lg max-h-56 object-cover w-full" />
                      )}
                      {s.post.video_url && (
                        <video src={s.post.video_url} controls className="mt-2 rounded-lg max-h-56 w-full" />
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 border-t border-destructive/20 divide-x divide-destructive/20">
                  <button
                    onClick={() => traiter(s.id, "dismiss")}
                    disabled={busy === s.id}
                    className="py-2.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                  >
                    Écarter
                  </button>
                  <button
                    onClick={() => traiter(s.id, "hide")}
                    disabled={busy === s.id}
                    className="py-2.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-50"
                  >
                    Retirer du fil
                  </button>
                  <button
                    onClick={() => traiter(s.id, "delete")}
                    disabled={busy === s.id}
                    className="py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    {busy === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <h3 className="text-sm font-semibold flex items-center gap-2 pt-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        File d'approbation
      </h3>

      {(data?.posts ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">
            Aucune publication en attente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.posts.map((p: any) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={p.auteur_photo || `https://api.dicebear.com/7.x/initials/svg?seed=${p.auteur}`}
                    alt="" className="w-9 h-9 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.auteur}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.category} · {new Date(p.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  {/* Un auteur déjà signalé mérite un second regard : c'est
                      l'information qui change la décision. */}
                  {p.signalements > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold shrink-0">
                      <AlertTriangle className="w-3 h-3" /> {p.signalements} signalement(s)
                    </span>
                  )}
                </div>

                <p className="text-sm mt-3 leading-relaxed whitespace-pre-line">{p.text}</p>

                {p.image_url && (
                  <img src={p.image_url} alt="" className="mt-3 rounded-xl max-h-72 object-cover w-full" />
                )}
                {p.video_url && (
                  <video src={p.video_url} controls className="mt-3 rounded-xl max-h-72 w-full" />
                )}
              </div>

              <div className="grid grid-cols-2 border-t border-border divide-x divide-border">
                <button
                  onClick={() => review(p.id, false)}
                  disabled={busy === p.id}
                  className="py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" /> Refuser
                </button>
                <button
                  onClick={() => review(p.id, true)}
                  disabled={busy === p.id}
                  className="py-3 text-sm font-semibold text-emerald-600 hover:bg-emerald-500/5 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Approuver
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Conversations signalées ─────────────────────────────────────────────────

function ConversationsTab() {
  const [data, setData] = useState<any>(null);
  const [filtre, setFiltre] = useState<"active" | "flagged" | "all">("active");
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [journal, setJournal] = useState<any>(null);
  const [vueJournal, setVueJournal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data: d, error: err } = await supabase.rpc("admin_conversations", {
      p_filter: filtre,
      p_search: recherche.trim() || null,
      p_limit: 100,
      p_offset: 0,
    });

    if (err || (d as any)?.error) {
      setError("Lecture impossible. La migration 49 a-t-elle été exécutée ?");
      setLoading(false);
      return;
    }
    setData(d);
    setLoading(false);
  };

  // La recherche est temporisée : sans cela, chaque frappe relancerait
  // une requête sur toutes les conversations.
  useEffect(() => {
    const t = setTimeout(load, recherche ? 350 : 0);
    return () => clearTimeout(t);
  }, [filtre, recherche]);

  const ouvrirJournal = async () => {
    const { data: j } = await supabase.rpc("admin_access_history", { p_limit: 200 });
    if (j && !(j as any).error) setJournal(j);
    setVueJournal(true);
  };

  const ouvrir = async (c: any) => {
    const motif = prompt(
      "Motif de la consultation — il sera inscrit au journal :",
      c.signalee ? `Signalement : ${c.motif}` : "",
    );
    if (!motif || motif.trim().length < 5) {
      toast.error("Un motif d'au moins 5 caractères est requis");
      return;
    }

    const { data: res, error: err } = await supabase.rpc("admin_read_conversation", {
      p_match_id: c.match_id, p_motif: motif.trim(),
    });

    if (err || (res as any)?.error) {
      toast.error("Consultation impossible");
      return;
    }

    setOuvert(c);
    setMessages((res as any).messages ?? []);
  };

  if (error) return <Erreur message={error} />;

  // ── Journal des accès ──
  if (vueJournal) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setVueJournal(false)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Retour aux conversations
        </button>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-serif text-lg font-semibold">Journal des consultations</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">
            Un membre finira par demander qui a lu ses messages. « Je ne sais
            pas » est la pire réponse possible — c'est à cela que sert ce
            journal, autant qu'au contrôle interne.
          </p>
          <div className="flex gap-6 mt-4">
            <div>
              <div className="text-2xl font-serif font-bold">{journal?.total ?? "—"}</div>
              <div className="text-xs text-muted-foreground">consultations au total</div>
            </div>
            <div>
              <div className="text-2xl font-serif font-bold">{journal?.total_30j ?? "—"}</div>
              <div className="text-xs text-muted-foreground">sur 30 jours</div>
            </div>
          </div>
        </div>

        {!journal?.acces?.length ? (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center">
            <p className="text-sm text-muted-foreground">Aucune consultation enregistrée.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {journal.acces.map((a: any) => (
              <div key={a.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.participants ?? "Conversation supprimée"}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("fr-FR")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Par <strong className="text-foreground">{a.admin}</strong> — {a.motif}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Conversation ouverte ──
  if (ouvert) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setOuvert(null); setMessages([]); }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Retour aux conversations
        </button>

        <div className="rounded-2xl border border-gold/50 bg-gold/10 p-3.5 flex gap-2.5">
          <Lock className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Consultation enregistrée au journal, avec votre identité,
            l'horodatage et le motif saisi.
          </p>
        </div>

        <p className="text-sm font-medium">
          {ouvert.user1?.nom} ↔ {ouvert.user2?.nom}
          <span className="text-muted-foreground font-normal"> · {messages.length} message(s)</span>
        </p>

        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Aucun message échangé dans cette conversation.
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender_id === ouvert.user1?.id ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  m.sender_id === ouvert.user1?.id
                    ? "bg-card border border-border"
                    : "bg-primary/10 border border-primary/20"
                }`}>
                  <p className="text-[11px] font-semibold opacity-70 mb-0.5">{m.auteur}</p>
                  {m.media_type && m.media_type !== "text" ? (
                    <p className="text-sm italic text-muted-foreground">
                      [{m.media_type}] {m.content}
                    </p>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  )}
                  <p className="text-[10px] opacity-60 mt-1">
                    {new Date(m.created_at).toLocaleString("fr-FR")}
                    {m.read_at && " · lu"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Liste ──
  const convs = data?.conversations ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-secondary/40 p-4 flex gap-3">
        <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Toutes les conversations</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Chaque ouverture exige un motif et laisse une trace nominative.
            Votre politique de confidentialité a été mise à jour pour
            annoncer cette pratique aux membres — une consultation qui
            contredirait vos engagements écrits serait le vrai risque.
          </p>
          <button
            onClick={ouvrirJournal}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Eye className="w-3.5 h-3.5" /> Voir le journal des consultations
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["active", "Avec messages"],
          ["flagged", `Signalées${data?.signalees ? ` (${data.signalees})` : ""}`],
          ["all", `Toutes${data?.total ? ` (${data.total})` : ""}`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFiltre(k as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtre === k
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un participant par prénom, nom ou ville…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-secondary animate-pulse" />)}
        </div>
      ) : convs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center">
          <MessagesSquare className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">
            {recherche ? "Aucun résultat pour cette recherche." : "Aucune conversation."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {convs.map((c: any) => (
            <button
              key={c.match_id}
              onClick={() => ouvrir(c)}
              className="w-full px-5 py-3.5 text-left hover:bg-secondary/40 transition-colors flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {c.user1?.nom} ↔ {c.user2?.nom}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {c.nb_messages} message(s)
                  {c.dernier && ` · dernier le ${new Date(c.dernier).toLocaleDateString("fr-FR")}`}
                  {/* Une conversation déjà consultée plusieurs fois doit se
                      remarquer — y compris quand c'est vous qui l'ouvrez. */}
                  {c.consultations > 0 && ` · consultée ${c.consultations} fois`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.signalee && (
                  <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold">
                    {c.motif || "Signalée"}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Éléments partagés ───────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function Champ({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
      </label>
      {hint && <p className="text-[11px] text-muted-foreground mb-1.5 -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${warn ? "border-gold/50 bg-gold/5" : "border-border bg-card"}`}>
      <div className="text-2xl font-serif font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Erreur({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
      <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
