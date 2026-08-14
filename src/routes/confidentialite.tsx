import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout, SITE_URL } from "@/components/public/PublicLayout";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité – Eden Rencontre" },
      {
        name: "description",
        content:
          "Comment Eden Rencontre collecte, utilise et protège vos données personnelles. Vos profils ne sont pas indexés par les moteurs de recherche.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/confidentialite` }],
  }),
  component: ConfidentialitePage,
});

const SECTIONS = [
  {
    h: "1. Données collectées",
    p: [
      "Lors de l'inscription : nom, adresse e-mail, date de naissance, genre et mot de passe chiffré.",
      "Lors de la constitution du profil : photos, biographie, ville et pays, confession, niveau de pratique, fréquence de participation aux assemblées, intention de mariage et souhait d'enfants. Ces éléments servent au calcul de compatibilité et à vos critères de recherche.",
      "Lors de l'usage : messages échangés, likes, profils consultés, date de dernière connexion.",
      "Lors d'un achat : votre numéro de téléphone est transmis au prestataire de paiement. Aucune donnée bancaire ne transite par nos serveurs ni n'y est conservée.",
    ],
  },
  {
    h: "2. Usage de vos données",
    p: [
      "Vos données servent exclusivement à faire fonctionner le service : vous proposer des profils pertinents, permettre les échanges, appliquer vos réglages de visibilité et traiter vos paiements.",
      "Nous ne vendons ni ne louons vos données à des tiers.",
      "Les contenus des membres sont explicitement exclus des robots d'entraînement de modèles d'intelligence artificielle.",
    ],
  },
  {
    h: "3. Qui voit quoi",
    p: [
      "Votre profil n'est visible que des membres connectés. Il est exclu de l'indexation par les moteurs de recherche : votre nom ne remontera pas dans une recherche Google.",
      "Vous contrôlez votre visibilité : accessible à tous, réservée aux personnes que vous avez likées, ou profil entièrement en pause.",
      "Vos conversations ne sont visibles d'aucun autre membre. Elles peuvent en revanche être consultées par notre équipe de modération, afin de protéger les membres contre le harcèlement, les tentatives d'escroquerie et les usages contraires à nos conditions.",
    ],
  },
  {
    h: "4. Conservation",
    p: [
      "Vos données sont conservées tant que votre compte est actif.",
      "À la suppression du compte, profil, photos et messages sont effacés. Certaines traces techniques et comptables liées aux paiements peuvent être conservées le temps requis par les obligations légales.",
    ],
  },
  {
    h: "5. Vos droits",
    p: [
      "Vous pouvez consulter et modifier vos informations à tout moment depuis votre profil.",
      "Vous pouvez supprimer votre compte depuis vos paramètres, sans avoir à en justifier le motif.",
      "Vous pouvez demander une copie de vos données ou leur effacement en nous écrivant.",
    ],
  },
  {
    h: "6. Sécurité",
    p: [
      "Les mots de passe sont stockés sous forme chiffrée et ne sont jamais accessibles en clair.",
      "Les échanges avec la plateforme sont chiffrés en transit.",
      "L'accès aux données est restreint par des règles appliquées au niveau de la base : un membre ne peut lire que ce qui le concerne.",
    ],
  },
  {
    h: "7. Sous-traitants",
    p: [
      "Hébergement et base de données : Supabase.",
      "Diffusion et protection du site : Cloudflare.",
      "Paiements : notre prestataire de paiement, qui traite seul les données de transaction.",
      "Appels audio et vidéo : Agora, pour le transport des flux uniquement.",
    ],
  },
];

function ConfidentialitePage() {
  return (
    <PublicLayout
      title="Politique de confidentialité"
      intro="Ce que nous collectons, pourquoi, et ce que vous pouvez en faire."
      breadcrumb={[{ label: "Confidentialité", to: "/confidentialite" }]}
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
        Voir également les{" "}
        <Link to="/conditions" className="text-primary underline">conditions d'utilisation</Link>.
        Ce document décrit les pratiques en vigueur ; faites-le valider par un juriste
        au regard du droit applicable dans vos pays d'activité.
      </p>
    </PublicLayout>
  );
}
