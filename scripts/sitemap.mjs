/**
 * Génère public/sitemap.xml à partir du contenu réel.
 *
 * Le fichier était écrit à la main. Chaque nouvel article devait y être
 * ajouté manuellement — et ne l'était pas : quatre articles y figuraient
 * alors que le blog en comptait davantage. Un article absent du sitemap
 * met des semaines à être découvert, quand il l'est.
 *
 * Les URL sont désormais dérivées de `ARTICLES` et de `COUNTRIES`. Ajouter
 * un article suffit : il apparaît au prochain build.
 *
 * Lu par expression régulière plutôt qu'importé : ces fichiers sont du
 * TypeScript, que Node n'exécute pas directement. Une étape de
 * compilation pour lire deux listes coûterait plus qu'elle ne rapporte.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://agapemeet.com";
const racine = process.cwd();

/** Extrait les valeurs d'un champ donné dans un fichier source. */
function champs(fichier, champ) {
  const src = readFileSync(join(racine, fichier), "utf8");
  const re = new RegExp(`^\\s+${champ}:\\s*"([^"]+)"`, "gm");
  return [...src.matchAll(re)].map(m => m[1]);
}

/**
 * Articles, avec leur date de publication.
 *
 * Les deux champs sont lus par paires ordonnées : dans le fichier
 * source, `publishedAt` suit toujours `slug` à quelques lignes près.
 * Les extraire séparément puis les apparier par index serait fragile —
 * une seule entrée mal formée décalerait tout le reste.
 */
function articlesAvecDates() {
  const src = readFileSync(join(racine, "src/content/articles.ts"), "utf8");
  const re = /^\s+slug:\s*"([^"]+)",[\s\S]*?^\s+publishedAt:\s*"([^"]+)"/gm;
  return [...src.matchAll(re)].map(m => ({ slug: m[1], date: m[2] }));
}

const aujourdhui = new Date().toISOString().slice(0, 10);

// Un article daté du futur n'existe pas encore pour le public. L'annoncer
// au sitemap enverrait Googlebot sur une page introuvable — et une erreur
// 404 servie depuis un sitemap dégrade la confiance accordée au fichier
// entier, donc l'indexation de tout le reste.
const tous = articlesAvecDates();
const articles = tous.filter(a => a.date <= aujourdhui).map(a => a.slug);
const aVenir = tous.length - articles.length;

const pays = champs("src/content/countries.ts", "slug");

if (tous.length === 0) {
  throw new Error("aucun article détecté — le sitemap serait incomplet");
}

/**
 * Pages fixes.
 *
 * Les espaces membres n'y figurent PAS : ils exigent une session, et
 * `robots.txt` les interdit déjà. Les déclarer ici enverrait Googlebot
 * sur des redirections vers /login — ce qui dégrade la confiance
 * accordée au sitemap tout entier.
 */
const fixes = [
  { url: "/",              priorite: "1.0", freq: "daily" },
  { url: "/inscription",   priorite: "0.9", freq: "monthly" },
  { url: "/tarifs",        priorite: "0.8", freq: "monthly" },
  { url: "/blog",          priorite: "0.8", freq: "weekly" },
  { url: "/faq",           priorite: "0.7", freq: "monthly" },
  { url: "/conditions",    priorite: "0.3", freq: "yearly" },
  { url: "/confidentialite", priorite: "0.3", freq: "yearly" },
];

const entrees = [
  ...fixes.map(p => ({ ...p, lastmod: aujourdhui })),
  // Les articles priment sur les pages pays : ce sont eux qui captent la
  // recherche de longue traîne.
  ...articles.map(s => ({
    url: `/blog/${s}`, priorite: "0.7", freq: "monthly", lastmod: aujourdhui,
  })),
  ...pays.map(s => ({
    url: `/rencontre-chretienne/${s}`, priorite: "0.6", freq: "monthly", lastmod: aujourdhui,
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Fichier GÉNÉRÉ par scripts/sitemap.mjs — ne pas modifier à la main. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entrees.map(e => `  <url>
    <loc>${SITE}${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.freq}</changefreq>
    <priority>${e.priorite}</priority>
  </url>`).join("\n")}
</urlset>
`;

writeFileSync(join(racine, "public", "sitemap.xml"), xml, "utf8");

console.log(
  `sitemap.xml : ${entrees.length} URL ` +
  `(${fixes.length} fixes, ${articles.length} articles, ${pays.length} pays)` +
  (aVenir > 0 ? ` — ${aVenir} article(s) programmé(s), non listés` : ""),
);
