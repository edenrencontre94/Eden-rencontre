import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicLayout, SITE_URL } from "@/components/public/PublicLayout";
import { articlesPublies, getArticle } from "@/content/articles";
import { fetchArticle } from "@/lib/blog";
import { ArrowRight, Clock } from "lucide-react";

export const Route = createFileRoute("/blog/$slug")({
  // Résolu avant le rendu : le contenu part avec le HTML, donc Google le
  // lit sans avoir à exécuter le JavaScript.
  loader: async ({ params }) => {
    // L'article du code est résolu d'abord, sans réseau : les quatre
    // existants restent servis instantanément même si la base est
    // indisponible. Un nouvel article écrit depuis le back-office passe
    // par la requête, mais toujours DANS le loader – donc rendu côté
    // serveur, donc indexable sans exécution de JavaScript.
    const statique = getArticle(params.slug);
    if (statique) return statique;

    const article = await fetchArticle(params.slug);
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData }) => {
    const a = loaderData;
    if (!a) return {};
    const url = `${SITE_URL}/blog/${a.slug}`;
    return {
      meta: [
        { title: `${a.title} – Eden Rencontre` },
        { name: "description", content: a.metaDescription },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.metaDescription },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: a.publishedAt },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: a.title,
            description: a.metaDescription,
            datePublished: a.publishedAt,
            author: { "@type": "Organization", name: "Eden Rencontre" },
            publisher: { "@type": "Organization", name: "Eden Rencontre" },
            mainEntityOfPage: url,
          }),
        },
      ],
    };
  },
  component: ArticlePage,
});

function ArticlePage() {
  const a = Route.useLoaderData();
  const others = articlesPublies().filter(x => x.slug !== a.slug).slice(0, 2);

  return (
    <PublicLayout
      title={a.title}
      breadcrumb={[
        { label: "Blog", to: "/blog" },
      ]}
    >
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground -mt-4 mb-6">
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{a.category}</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.readingMinutes} min de lecture</span>
        <time dateTime={a.publishedAt}>
          {new Date(a.publishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </time>
      </div>

      <p className="text-base leading-relaxed text-foreground/90">{a.intro}</p>

      <div className="mt-8 space-y-8">
        {a.sections.map(s => (
          <section key={s.heading}>
            <h2 className="font-serif text-xl font-semibold text-primary">{s.heading}</h2>
            <div className="mt-2 space-y-3">
              {s.body.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border-l-4 border-primary bg-secondary/40 p-4">
        <p className="text-sm leading-relaxed">{a.conclusion}</p>
      </div>

      <div className="mt-10 rounded-2xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground p-6 text-center">
        <h2 className="font-serif text-xl font-semibold">Prêt à rencontrer quelqu'un ?</h2>
        <p className="text-sm opacity-90 mt-1.5">
          Eden Rencontre réunit des célibataires chrétiens décidés à bâtir un foyer.
        </p>
        <Link
          to="/inscription"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-primary px-5 py-2.5 text-sm font-semibold"
        >
          Créer mon compte gratuitement <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {others.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-lg font-semibold mb-3">À lire également</h2>
          <div className="space-y-2">
            {others.map(o => (
              <Link
                key={o.slug}
                to="/blog/$slug"
                params={{ slug: o.slug }}
                className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
              >
                <div className="font-semibold text-sm">{o.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{o.excerpt}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
