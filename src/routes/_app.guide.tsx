import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowLeft, Compass, Camera, PenLine, MessageCircle, Church,
  HeartHandshake, ShieldCheck, Clock, Users, ArrowRight, Sparkles,
} from "lucide-react";
import { useSetting } from "@/lib/appSettings";

export const Route = createFileRoute("/_app/guide")({
  head: () => ({
    meta: [{ title: "Guide – Eden Rencontre" }],
  }),
  component: GuidePage,
});

type Conseil = {
  icone: typeof Camera;
  titre: string;
  texte: string;
};

/**
 * Six conseils, pas vingt.
 *
 * Une liste exhaustive n'est jamais lue en entier. Chacun porte une
 * action concrète – pas « soyez authentique », qui ne dit à personne quoi
 * faire ensuite.
 */
const CONSEILS: Conseil[] = [
  {
    icone: Camera,
    titre: "Soignez votre photo principale",
    texte:
      "Un portrait net, le visage bien visible, dans une lumière naturelle. C'est la première chose que l'on voit – et souvent la seule si elle ne donne pas envie d'en savoir plus. Évitez les photos de groupe : personne ne devrait avoir à deviner qui vous êtes.",
  },
  {
    icone: PenLine,
    titre: "Complétez votre profil en entier",
    texte:
      "Vision du mariage, centres d'intérêt, ce que vous recherchez, ce que vous n'acceptez pas. Un profil complet apparaît plus haut dans les suggestions et reçoit nettement plus de visites qu'un profil laissé à moitié vide.",
  },
  {
    icone: Church,
    titre: "Parlez de votre foi concrètement",
    texte:
      "« Je suis chrétien » ne distingue personne ici. Votre église, ce que vous y vivez, ce que la prière change dans vos journées : voilà ce qui permet à quelqu'un de reconnaître un chemin proche du sien.",
  },
  {
    icone: MessageCircle,
    titre: "Écrivez un premier message qui appelle une réponse",
    texte:
      "« Salut » n'engage à rien et n'obtient presque jamais de réponse. Relevez un détail de son profil – une conviction, un centre d'intérêt, une phrase – et posez une vraie question dessus.",
  },
  {
    icone: Clock,
    titre: "Laissez le temps faire son travail",
    texte:
      "Une relation orientée vers le mariage ne se décide pas en trois échanges. Prenez le temps de connaître la personne, sa famille, son église, sa manière de traiter les autres quand rien ne l'y oblige.",
  },
  {
    icone: ShieldCheck,
    titre: "Protégez-vous",
    texte:
      "Ne communiquez jamais vos coordonnées bancaires. Méfiez-vous de quiconque demande de l'argent, quel que soit le motif invoqué. Pour une première rencontre, choisissez un lieu public et prévenez un proche. Signalez tout comportement déplacé : le bouton est sur chaque profil.",
  },
];

const ETAPES = [
  { n: "1", titre: "Complétez votre profil", texte: "Photo, foi, vision du mariage." },
  { n: "2", titre: "Découvrez des profils", texte: "Chaque jour, des suggestions compatibles." },
  { n: "3", titre: "Engagez la conversation", texte: "Après un match mutuel." },
  { n: "4", titre: "Rencontrez, en vérité", texte: "Quand la confiance est là." },
];

function GuidePage() {
  // Piloté depuis /admin/parametres : un canal WhatsApp se recrée, et
  // rediriger les membres ne doit pas demander un déploiement.
  //
  // La valeur par défaut est le canal réel, pas une chaîne vide : tant
  // que la migration 53 n'a pas été exécutée, `app_settings` ne contient
  // pas la clé – et un défaut vide faisait disparaître le bouton.
  const lienCommunaute = useSetting<string>(
    "community_whatsapp",
    "https://whatsapp.com/channel/0029Vb93f4D35fLrflJx9g0U",
  );
  const pitchCommunaute = useSetting<string>(
    "community_whatsapp_pitch",
    "Enseignements, témoignages de couples, temps de prière et annonces : notre canal WhatsApp prolonge ce que vous vivez ici.",
  );

  return (
    <div className="pb-12">
      {/* â”€â”€ En-tête â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground">
        <div
          aria-hidden
          className="absolute -top-16 -right-12 w-56 h-56 rounded-full bg-gold/20 blur-3xl"
        />
        <div className="relative px-4 pt-4 pb-10">
          <Link
            to="/accueil"
            className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/80 hover:text-primary-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" /> Accueil
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 max-w-lg"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary-foreground/15 backdrop-blur flex items-center justify-center">
              <Compass className="w-6 h-6" />
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold mt-4 leading-tight">
              Réussir votre recherche
            </h1>
            <p className="text-primary-foreground/85 mt-3 text-sm sm:text-base leading-relaxed">
              Eden Rencontre n'est pas une application de rencontre comme les autres.
              On n'y cherche pas une distraction, mais un conjoint. Voici ce qui
              fait la différence entre un profil que l'on survole et un profil
              auquel on écrit.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto">
        {/* â”€â”€ Le parcours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold">Comment ça se passe</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {ETAPES.map((e, i) => (
              <motion.div
                key={e.n}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="rounded-2xl border border-border/60 bg-card p-4"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {e.n}
                </span>
                <h3 className="text-sm font-semibold mt-2.5">{e.titre}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {e.texte}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* â”€â”€ Les conseils â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="mt-10">
          <h2 className="font-serif text-xl font-semibold">Six conseils qui changent tout</h2>
          <div className="mt-4 space-y-3">
            {CONSEILS.map((c, i) => (
              <motion.article
                key={c.titre}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                className="rounded-2xl border border-border/60 bg-card p-5 flex gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <c.icone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm">{c.titre}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {c.texte}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* â”€â”€ Le verset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="mt-10">
          <div className="rounded-3xl border border-gold/30 bg-gold/5 p-6 text-center">
            <Sparkles className="w-5 h-5 text-gold mx-auto" />
            <p className="font-serif text-lg leading-relaxed mt-3 italic">
              « Recommande ton sort à l'Éternel, mets en lui ta confiance,
              et il agira. »
            </p>
            <p className="text-xs font-bold text-gold mt-3 uppercase tracking-wider">
              Psaume 37:5
            </p>
          </div>
        </section>

        {/* â”€â”€ La communauté â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            Masquée si aucun lien n'est configuré : un bouton
            « Rejoindre » menant vers un canal supprimé ferait croire à
            une panne de l'application. */}
        {lienCommunaute && (
          <section className="mt-10">
            <div className="rounded-3xl overflow-hidden border border-border/60 bg-card">
              <div className="bg-gradient-to-br from-primary/10 to-gold/10 p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary mx-auto flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
                <h2 className="font-serif text-2xl font-semibold mt-4">
                  Rejoignez la communauté
                </h2>
                <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed max-w-md mx-auto">
                  {pitchCommunaute} Vous y êtes accompagné, pas seulement
                  inscrit.
                </p>

                {/* Lien externe : `<a>` et non `<Link>`, qui ne gère que les
                    routes internes. `noopener` empêche la page ouverte
                    d'accéder à la nôtre via window.opener. */}
                <a
                  href={lienCommunaute}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full bg-[#25D366] text-white font-semibold shadow-elegant hover:brightness-105 active:scale-[0.98] transition"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  Rejoindre la communauté
                </a>

                <p className="text-[11px] text-muted-foreground mt-3">
                  Ouvre WhatsApp · Gratuit · Vous pouvez quitter à tout moment
                </p>
              </div>
            </div>
          </section>
        )}

        {/* â”€â”€ Retour à l'action â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="mt-8 grid sm:grid-cols-2 gap-3">
          <Link
            to="/decouvrir"
            className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 hover:bg-secondary/40 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Découvrir des profils</h3>
              <p className="text-xs text-muted-foreground">Vos suggestions du jour</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>

          <Link
            to="/profil"
            className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 hover:bg-secondary/40 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <PenLine className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Compléter mon profil</h3>
              <p className="text-xs text-muted-foreground">Le premier levier</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        </section>
      </div>
    </div>
  );
}

/** Logo WhatsApp – lucide n'en fournit aucun. */
function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
