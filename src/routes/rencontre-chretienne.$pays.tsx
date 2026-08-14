import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicLayout, SITE_URL } from "@/components/public/PublicLayout";
import { COUNTRIES, getCountry } from "@/content/countries";
import { ArrowRight, Church, MapPin, ShieldCheck } from "lucide-react";

/**
 * URL de la forme /rencontre-chretienne/togo.
 *
 * Le mot-clé est placé DANS le chemin plutôt que dans un paramètre du type
 * /pays?nom=togo : Google accorde du poids à la structure de l'URL, et une
 * adresse lisible est aussi plus partageable.
 */
export const Route = createFileRoute("/rencontre-chretienne/$pays")({
  loader: ({ params }) => {
    const country = getCountry(params.pays);
    if (!country) throw notFound();
    return country;
  },
  head: ({ loaderData }) => {
    const c = loaderData;
    if (!c) return {};
    const url = `${SITE_URL}/rencontre-chretienne/${c.slug}`;
    return {
      meta: [
        { title: `${c.title} | Eden Rencontre` },
        { name: "description", content: c.metaDescription },
        { property: "og:title", content: c.title },
        { property: "og:description", content: c.metaDescription },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: c.faq.map(f => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
    };
  },
  component: CountryPage,
});

function CountryPage() {
  const c = Route.useLoaderData();
  const others = COUNTRIES.filter(x => x.slug !== c.slug);

  return (
    <PublicLayout
      title={c.title}
      intro={c.intro}
      breadcrumb={[{ label: c.name, to: `/rencontre-chretienne/${c.slug}` }]}
    >
      <div className="text-4xl -mt-4 mb-6" aria-hidden>{c.flag}</div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
          <Church className="w-5 h-5 text-primary" /> Le paysage chrétien {c.demonym}
        </h2>
        <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">{c.paysage}</p>
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" /> Où sont nos membres
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Eden Rencontre est accessible depuis tout le pays. Les principales villes couvertes :
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {c.cities.map(city => (
            <span key={city} className="px-3 py-1 rounded-full bg-secondary text-xs font-medium">
              {city}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border-l-4 border-primary bg-secondary/40 p-5">
        <h2 className="font-serif text-lg font-semibold">Un conseil pour votre recherche</h2>
        <p className="text-sm mt-2 leading-relaxed">{c.conseil}</p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold mb-3">Questions fréquentes</h2>
        <div className="space-y-3">
          {c.faq.map(f => (
            <details key={f.q} className="group rounded-2xl border border-border bg-card p-4">
              <summary className="font-semibold text-sm cursor-pointer list-none flex items-start justify-between gap-3">
                {f.q}
                <span className="text-muted-foreground shrink-0 transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-8 rounded-2xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground p-6 text-center">
        <ShieldCheck className="w-8 h-8 mx-auto opacity-90" />
        <h2 className="font-serif text-xl font-semibold mt-2">
          Rejoignez Eden Rencontre {c.name === "France" ? "en" : "au"} {c.name}
        </h2>
        <p className="text-sm opacity-90 mt-1.5">
          Inscription gratuite, profil visible uniquement des membres.
        </p>
        <Link
          to="/inscription"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-primary px-5 py-2.5 text-sm font-semibold"
        >
          Créer mon compte <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Maillage interne : chaque page pays renvoie vers les autres, ce qui
          aide Google à toutes les découvrir depuis n'importe laquelle. */}
      <section className="mt-10">
        <h2 className="font-serif text-lg font-semibold mb-3">Dans d'autres pays</h2>
        <div className="flex flex-wrap gap-2">
          {others.map(o => (
            <Link
              key={o.slug}
              to="/rencontre-chretienne/$pays"
              params={{ pays: o.slug }}
              className="px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 transition-colors"
            >
              {o.flag} {o.name}
            </Link>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
