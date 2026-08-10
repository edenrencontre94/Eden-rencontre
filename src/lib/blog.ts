import { supabase } from "@/lib/supabase";
import { articlesPublies, type Article } from "@/content/articles";

/**
 * Articles du blog : base de données ET code.
 *
 * Les quatre articles existants restent dans `src/content/articles.ts`.
 * Ils sont rendus côté serveur, donc indexables immédiatement, et ne
 * dépendent d'aucune requête réseau — les supprimer pour tout basculer en
 * base ferait perdre cet avantage sans rien gagner.
 *
 * Les nouveaux articles, eux, sont écrits depuis le back-office. Les deux
 * sources sont fusionnées à la lecture ; en cas de doublon d'adresse, la
 * base l'emporte — c'est elle qu'on peut corriger sans déploiement.
 */

type DbPost = {
  slug: string;
  title: string;
  meta_description: string | null;
  excerpt: string | null;
  category: string;
  intro: string | null;
  sections: { heading: string; body: string[] }[] | null;
  conclusion: string | null;
  published_at: string | null;
};

/** Estimation de la durée de lecture : environ 200 mots par minute. */
function minutesDeLecture(a: Omit<Article, "readingMinutes">): number {
  const mots = [
    a.intro,
    ...a.sections.flatMap(s => [s.heading, ...s.body]),
    a.conclusion,
  ].join(" ").split(/\s+/).length;
  return Math.max(2, Math.round(mots / 200));
}

function versArticle(p: DbPost): Article {
  const base = {
    slug: p.slug,
    title: p.title,
    metaDescription: p.meta_description ?? p.excerpt ?? p.title,
    excerpt: p.excerpt ?? "",
    publishedAt: p.published_at ?? new Date().toISOString(),
    category: p.category,
    intro: p.intro ?? "",
    sections: p.sections ?? [],
    conclusion: p.conclusion ?? "",
  };
  return { ...base, readingMinutes: minutesDeLecture(base) };
}

/**
 * Tous les articles, base et code confondus.
 *
 * Une erreur de lecture ne vide pas le blog : on retombe sur les articles
 * du code. Une page de blog vide coûte plus cher qu'un article manquant —
 * elle fait perdre la confiance et le référencement acquis.
 */
export async function fetchArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, title, meta_description, excerpt, category, intro, sections, conclusion, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[blog] lecture:", error);
    return articlesPublies();
  }

  // Les articles de base peuvent eux aussi porter une date future : le
  // statut « published » dit qu ils sont prets, pas qu ils sont parus.
  const auj = new Date().toISOString().slice(0, 10);

  const depuisBase = (data ?? [])
    .map((p: any) => versArticle(p as DbPost))
    .filter((a: Article) => a.publishedAt <= auj);

  const adressesBase = new Set(depuisBase.map((a: Article) => a.slug));

  return [...depuisBase, ...articlesPublies().filter(a => !adressesBase.has(a.slug))]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function fetchArticle(slug: string): Promise<Article | undefined> {
  const { data } = await supabase
    .from("blog_posts")
    .select("slug, title, meta_description, excerpt, category, intro, sections, conclusion, published_at")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  const auj = new Date().toISOString().slice(0, 10);

  // Une adresse devinee ne doit pas donner acces a un texte non paru.
  if (data) {
    const a = versArticle(data as DbPost);
    return a.publishedAt <= auj ? a : undefined;
  }
  return articlesPublies().find(a => a.slug === slug);
}
