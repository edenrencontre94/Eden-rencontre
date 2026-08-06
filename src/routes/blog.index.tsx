import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout, SITE_URL } from "@/components/public/PublicLayout";
import { useEffect, useState } from "react";
import { ARTICLES, type Article } from "@/content/articles";
import { fetchArticles } from "@/lib/blog";
import { Clock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Conseils pour une relation chrétienne durable | AgapeMeet" },
      {
        name: "description",
        content:
          "Conseils concrets sur le discernement, la préparation au mariage chrétien, la sécurité des rencontres en ligne et la vie spirituelle du célibataire.",
      },
      { property: "og:title", content: "Blog AgapeMeet — mariage et relations chrétiennes" },
      { property: "og:url", content: `${SITE_URL}/blog` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/blog` }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  // Les articles du code s'affichent IMMÉDIATEMENT — ils sont rendus côté
  // serveur, donc indexables sans attendre. Ceux de la base viennent s'y
  // ajouter au chargement. L'inverse aurait produit une page vide au
  // premier rendu, exactement ce qu'un moteur de recherche retiendrait.
  const [articles, setArticles] = useState<Article[]>(
    [...ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  );

  useEffect(() => { fetchArticles().then(setArticles); }, []);

  const sorted = articles;

  return (
    <PublicLayout
      title="Le blog"
      intro="Des repères concrets sur le discernement, la préparation au mariage et les rencontres en ligne — sans langue de bois."
      breadcrumb={[{ label: "Blog", to: "/blog" }]}
    >
      <div className="space-y-4">
        {sorted.map(a => (
          <article key={a.slug} className="rounded-2xl border border-border bg-card p-5 hover:shadow-soft transition-shadow">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                {a.category}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {a.readingMinutes} min
              </span>
              <time dateTime={a.publishedAt}>
                {new Date(a.publishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </time>
            </div>

            <h2 className="font-serif text-xl font-semibold mt-2 leading-snug">
              <Link to="/blog/$slug" params={{ slug: a.slug }} className="hover:text-primary transition-colors">
                {a.title}
              </Link>
            </h2>

            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{a.excerpt}</p>

            <Link
              to="/blog/$slug"
              params={{ slug: a.slug }}
              className="inline-flex items-center gap-1.5 text-sm text-primary font-medium mt-3 hover:underline"
            >
              Lire l'article <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </article>
        ))}
      </div>
    </PublicLayout>
  );
}
