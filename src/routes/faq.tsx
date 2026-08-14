import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout, SITE_URL } from "@/components/public/PublicLayout";
import { FAQ, FAQ_CATEGORIES } from "@/content/faq";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Questions fréquentes – Eden Rencontre" },
      {
        name: "description",
        content:
          "Toutes les réponses sur Eden Rencontre : inscription gratuite, fonctionnement des matchs, Super Likes, sécurité des profils, paiement Mobile Money et abonnements sans reconduction.",
      },
      { property: "og:title", content: "Questions fréquentes – Eden Rencontre" },
      { property: "og:url", content: `${SITE_URL}/faq` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/faq` }],
    scripts: [
      {
        type: "application/ld+json",
        // Balisage FAQPage : c'est lui qui permet à Google d'afficher les
        // questions directement dans ses résultats de recherche.
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(item => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <PublicLayout
      title="Questions fréquentes"
      intro="Tout ce qu'il faut savoir avant de rejoindre Eden Rencontre – et après."
      breadcrumb={[{ label: "FAQ", to: "/faq" }]}
    >
      <div className="space-y-10">
        {FAQ_CATEGORIES.map(category => (
          <section key={category}>
            <h2 className="font-serif text-xl font-semibold text-primary mb-4">{category}</h2>
            <div className="space-y-3">
              {FAQ.filter(f => f.category === category).map(item => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-border bg-card p-4 open:shadow-soft"
                >
                  <summary className="font-semibold text-sm cursor-pointer list-none flex items-start justify-between gap-3">
                    {item.q}
                    <span className="text-muted-foreground shrink-0 transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-2xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground p-6 text-center">
        <h2 className="font-serif text-xl font-semibold">Une autre question ?</h2>
        <p className="text-sm opacity-90 mt-1.5">
          Le plus simple reste encore d'essayer – l'inscription est gratuite.
        </p>
        <Link
          to="/inscription"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-primary px-5 py-2.5 text-sm font-semibold"
        >
          Créer mon compte <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </PublicLayout>
  );
}
