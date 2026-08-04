import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout, SITE_URL } from "@/components/public/PublicLayout";
import { PLANS, OFFERS, BOOST_OFFERS, formatPrice, offersFor } from "@/lib/plans";
import { ArrowRight, Check, X, Crown, Rocket } from "lucide-react";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs — AgapeMeet | Formules Gratuite, Premium et VIP" },
      {
        name: "description",
        content:
          "Tarifs AgapeMeet : formule Gratuite, Premium dès 2 500 FCFA les 15 jours et VIP à 12 000 FCFA. Paiement unique par Mobile Money ou carte, sans reconduction automatique.",
      },
      { property: "og:title", content: "Tarifs AgapeMeet — Premium dès 2 500 FCFA" },
      { property: "og:url", content: `${SITE_URL}/tarifs` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/tarifs` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Abonnement AgapeMeet",
          description:
            "Accès aux fonctionnalités avancées d'AgapeMeet : visiteurs, likes illimités, Super Likes, Boosts et filtres avancés.",
          brand: { "@type": "Brand", name: "AgapeMeet" },
          offers: OFFERS.map(o => ({
            "@type": "Offer",
            name: `${o.planId === "vip" ? "VIP" : "Premium"} ${o.label}`,
            price: o.priceXOF,
            priceCurrency: "XOF",
            availability: "https://schema.org/InStock",
            url: `${SITE_URL}/tarifs`,
          })),
        }),
      },
    ],
  }),
  component: TarifsPage,
});

function TarifsPage() {
  return (
    <PublicLayout
      title="Nos formules"
      intro="Paiement unique, sans engagement ni prélèvement automatique. Vous achetez une durée précise, et rien ne vous sera débité ensuite."
      breadcrumb={[{ label: "Tarifs", to: "/tarifs" }]}
    >
      <div className="space-y-5">
        {PLANS.map(plan => {
          const offers = offersFor(plan.id);
          const free = plan.id === "gratuit";

          return (
            <section
              key={plan.id}
              className={`rounded-2xl border p-5 ${
                plan.highlight
                  ? "border-primary bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-elegant"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl font-semibold flex items-center gap-2">
                    {plan.name}
                    {plan.id === "vip" && <Crown className="w-5 h-5 text-gold" />}
                  </h2>
                  <p className={`text-xs mt-0.5 ${plan.highlight ? "opacity-85" : "text-muted-foreground"}`}>
                    {plan.tagline}
                  </p>
                </div>
                {free && (
                  <span className="shrink-0 px-3 py-1 rounded-full bg-secondary text-muted-foreground text-xs font-semibold">
                    0 FCFA
                  </span>
                )}
              </div>

              <p className={`text-sm mt-3 font-medium ${plan.highlight ? "opacity-95" : ""}`}>
                {plan.promise}
              </p>

              <ul className="mt-4 space-y-2 text-sm">
                {plan.perks.map(perk => (
                  <li key={perk} className="flex gap-2">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlight ? "text-gold" : "text-primary"}`} />
                    <span className={plan.highlight ? "opacity-95" : ""}>{perk}</span>
                  </li>
                ))}
              </ul>

              {plan.limits && (
                <ul className="mt-3 space-y-2 text-sm border-t border-border/40 pt-3">
                  {plan.limits.map(l => (
                    <li key={l} className="flex gap-2 text-muted-foreground">
                      <X className="w-4 h-4 mt-0.5 shrink-0 opacity-60" />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              )}

              {!free && (
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {offers.map(o => (
                    <div
                      key={o.id}
                      className={`rounded-xl px-3 py-2.5 text-center ${
                        plan.highlight ? "bg-white/15" : "bg-secondary"
                      }`}
                    >
                      <div className="text-xs opacity-80">{o.label}</div>
                      <div className="font-serif text-lg font-semibold">{formatPrice(o.priceXOF)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Boosts à l'unité */}
      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" /> Boosts à l'unité
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Mettez votre profil en tête des découvertes, sans souscrire d'abonnement.
          Ouvert à tous, y compris en formule Gratuite.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {BOOST_OFFERS.map(b => (
            <div key={b.id} className="rounded-xl bg-secondary px-3 py-2.5 text-center">
              <div className="text-xs text-muted-foreground">{b.duration}</div>
              <div className="font-serif text-lg font-semibold">{formatPrice(b.priceXOF)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-secondary/40 p-5">
        <h2 className="font-serif text-lg font-semibold">Comment payer</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Mobile Money — Togocel Money, Moov Money, Orange Money, MTN MoMo, Wave selon
          votre pays — ainsi que les cartes Visa et Mastercard. Les moyens proposés
          s'adaptent automatiquement à l'indicatif téléphonique que vous saisissez.
        </p>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          <strong className="text-foreground">Aucune reconduction automatique.</strong>{" "}
          Vous achetez une durée, elle se termine, et rien ne se relance sans vous.
          Un nouvel achat pendant une période active la prolonge au lieu de la remplacer.
        </p>
      </section>

      <div className="mt-10 text-center">
        <Link
          to="/inscription"
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold shadow-elegant"
        >
          Commencer gratuitement <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-muted-foreground mt-3">
          Vous pouvez aussi consulter <Link to="/faq" className="text-primary underline">les questions fréquentes</Link>.
        </p>
      </div>
    </PublicLayout>
  );
}
