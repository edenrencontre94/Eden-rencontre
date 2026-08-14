import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, SITE_URL } from "@/components/public/PublicLayout";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation – Eden Rencontre" },
      {
        name: "description",
        content: "Conditions générales d'utilisation d'Eden Rencontre : accès au service, comportement attendu, abonnements et résiliation.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/conditions` }],
  }),
  component: ConditionsPage,
});

const SECTIONS = [
  {
    h: "1. Objet",
    p: [
      "Eden Rencontre est un service de mise en relation destiné à des personnes majeures de confession chrétienne recherchant une relation sérieuse orientée vers le mariage.",
      "L'utilisation du service implique l'acceptation pleine et entière des présentes conditions.",
    ],
  },
  {
    h: "2. Accès au service",
    p: [
      "L'inscription est réservée aux personnes âgées d'au moins 18 ans. Toute inscription d'un mineur entraîne la suppression immédiate du compte.",
      "Vous vous engagez à fournir des informations exactes et à maintenir votre profil à jour. Les photos publiées doivent vous représenter et vous appartenir.",
      "Un seul compte par personne est autorisé.",
    ],
  },
  {
    h: "3. Comportement attendu",
    p: [
      "Le respect des autres membres est la condition première de l'accès au service. Sont notamment interdits : le harcèlement, les propos haineux ou discriminatoires, les contenus à caractère sexuel, l'usurpation d'identité et la sollicitation commerciale.",
      "Toute demande d'argent adressée à un autre membre est strictement interdite et entraîne la suspension immédiate du compte.",
      "Chaque membre dispose d'outils de signalement et de blocage. Les signalements sont examinés et peuvent conduire à la suspension ou à la suppression d'un compte.",
    ],
  },
  {
    h: "4. Abonnements et paiements",
    p: [
      "La formule Premium est vendue sous forme de durées déterminées, réglées en une seule fois. Aucune reconduction automatique n'est appliquée et aucun prélèvement récurrent n'est effectué.",
      "Un achat effectué pendant une période active prolonge celle-ci au lieu de la remplacer.",
      "Les paiements sont traités par un prestataire tiers. Eden Rencontre ne conserve aucune donnée bancaire.",
      "Les fonctionnalités incluses dans chaque formule sont décrites sur la page Tarifs et peuvent évoluer. Toute évolution défavorable ne s'applique pas aux durées déjà achetées.",
    ],
  },
  {
    h: "5. Suppression du compte",
    p: [
      "Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. La suppression est définitive et entraîne l'effacement de votre profil, de vos correspondances et de vos données associées.",
      "Aucun remboursement n'est dû au titre d'une durée d'abonnement non consommée en cas de suppression volontaire du compte.",
    ],
  },
  {
    h: "6. Responsabilité",
    p: [
      "Eden Rencontre met en relation des personnes mais n'intervient pas dans les échanges ni dans les rencontres qui en découlent. Chaque membre reste responsable de ses décisions et de sa sécurité.",
      "Nous mettons en œuvre des moyens de vérification et de modération, sans pouvoir garantir l'exactitude de toutes les informations publiées par les membres.",
      "Il est recommandé d'observer les précautions d'usage lors d'une première rencontre : lieu public, information d'un proche, moyen de retour autonome.",
    ],
  },
  {
    h: "7. Propriété intellectuelle",
    p: [
      "L'ensemble des éléments composant la plateforme – marque, interface, textes, éléments graphiques – demeure la propriété d'Eden Rencontre.",
      "Vous conservez la propriété des contenus que vous publiez et accordez à Eden Rencontre le droit de les afficher aux autres membres dans le cadre du service.",
    ],
  },
  {
    h: "8. Modification des conditions",
    p: [
      "Les présentes conditions peuvent être modifiées. Toute modification substantielle sera portée à la connaissance des membres au sein de l'application.",
    ],
  },
];

function ConditionsPage() {
  return (
    <PublicLayout
      title="Conditions d'utilisation"
      intro="Les règles qui encadrent l'usage d'Eden Rencontre."
      breadcrumb={[{ label: "Conditions", to: "/conditions" }]}
    >
      <div className="space-y-7">
        {SECTIONS.map(s => (
          <section key={s.h}>
            <h2 className="font-serif text-lg font-semibold text-primary">{s.h}</h2>
            <div className="mt-2 space-y-2.5">
              {s.p.map((t, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">{t}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-10 pt-6 border-t border-border">
        Ces conditions constituent un cadre général. Avant toute exploitation
        commerciale à grande échelle, faites-les valider par un juriste au regard
        du droit applicable dans vos pays d'activité.
      </p>
    </PublicLayout>
  );
}
