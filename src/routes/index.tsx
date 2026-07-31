import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Heart,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Users,
  CheckCircle2,
  Star,
  ArrowRight,
  Church,
  HeartHandshake,
  Lock,
  Crown,
  Instagram,
  Facebook,
  Twitter,
  Mail,
} from "lucide-react";
import logoAsset from "@/assets/logo.jpg";
import { useState } from "react";
import heroCouple from "@/assets/hero-couple.jpg";
import testimonial1 from "@/assets/testimonial-1.jpg";
import testimonial2 from "@/assets/testimonial-2.jpg";
import testimonial3 from "@/assets/testimonial-3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgapeMeet  , Là où la foi unit les cœurs" },
      {
        name: "description",
        content:
          "AgapeMeet, la plateforme №1 de rencontres sérieuses chrétiennes. Rencontrez votre futur conjoint dans un espace sécurisé, centré sur la foi et le mariage.",
      },
      { property: "og:title", content: "AgapeMeet  , Là où la foi unit les cœurs" },
      {
        property: "og:description",
        content:
          "AgapeMeet, la plateforme №1 de rencontres sérieuses chrétiennes. Rencontrez votre futur conjoint dans un espace sécurisé, centré sur la foi et le mariage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "AgapeMeet",
          description:
            "Plateforme de rencontres sérieuses chrétiennes en Afrique francophone et à l'international.",
          url: "/",
        }),
      },
    ],
  }),
  component: Index,
});

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <img src={logoAsset} alt="AgapeMeet" className="w-10 h-10 object-contain" />
          <span className="font-serif text-xl font-semibold tracking-tight">
            Agape<span className="text-gold">Meet</span>
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#comment" className="hover:text-foreground transition">Comment ça marche</a>
          <a href="#pourquoi" className="hover:text-foreground transition">Pourquoi nous</a>
          <a href="#temoignages" className="hover:text-foreground transition">Témoignages</a>
          <a href="#tarifs" className="hover:text-foreground transition">Tarifs</a>
          <a href="#faq" className="hover:text-foreground transition">FAQ</a>
        </nav>
        <Link
          to="/inscription"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition shadow-soft"
        >
          Commencer
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/40 via-background to-background" />
      <div className="absolute top-20 -left-40 w-96 h-96 rounded-full bg-gold/10 blur-3xl -z-10" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-soft px-3 py-1 text-xs font-medium text-gold-foreground mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            La rencontre chrétienne, réinventée
          </div>
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-foreground">
            Là où la foi
            <br />
            unit les <span className="italic text-gradient-gold">cœurs.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
            AgapeMeet est la plateforme dédiée aux chrétiens qui recherchent un
            mariage centré sur Christ. Sécurisé. Bienveillant. Sérieux.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/inscription"
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-4 text-base font-medium hover:bg-primary/90 transition shadow-elegant"
            >
              Commencer gratuitement
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-7 py-4 text-base font-medium hover:bg-secondary transition"
            >
              Accéder à l'app
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-success" />
              Profils vérifiés
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-success" />
              100% sécurisé
            </div>
            <div className="flex items-center gap-1.5">
              <Church className="w-4 h-4 text-success" />
              Valeurs chrétiennes
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="relative"
        >
          <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden shadow-elegant">
            <img
              src={heroCouple}
              alt="Couple chrétien élégant"
              className="w-full h-full object-cover"
              width={1400}
              height={1600}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="absolute -left-4 md:-left-10 top-10 rounded-2xl bg-background shadow-elegant px-4 py-3 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-success/15 grid place-items-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Compatibilité</p>
              <p className="text-lg font-semibold text-foreground">98%</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="absolute -right-4 md:-right-6 bottom-16 rounded-2xl bg-background shadow-elegant px-4 py-3 flex items-center gap-3 max-w-[240px]"
          >
            <div className="w-10 h-10 rounded-full bg-gold-soft grid place-items-center">
              <BookOpen className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Verset partagé</p>
              <p className="text-sm font-medium text-foreground leading-tight">
                « Ecclésiaste 4:9 »
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { value: "120K+", label: "Membres chrétiens" },
    { value: "3 200+", label: "Couples formés" },
    { value: "24 pays", label: "Francophones" },
    { value: "4,9/5", label: "Note moyenne" },
  ];
  return (
    <section className="border-y border-border/60 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-serif text-3xl md:text-4xl font-semibold text-primary">
              {s.value}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Users,
      title: "Créez votre profil",
      desc: "Partagez votre histoire, votre foi et vos aspirations en quelques minutes.",
    },
    {
      icon: Sparkles,
      title: "Découvrez vos affinités",
      desc: "Notre algorithme croise foi, valeurs et projet de vie pour révéler les meilleures compatibilités.",
    },
    {
      icon: HeartHandshake,
      title: "Bâtissez une relation",
      desc: "Échangez sereinement, priez ensemble, et avancez vers un mariage centré sur Christ.",
    },
  ];
  return (
    <section id="comment" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Comment ça marche</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Trois étapes vers votre <span className="italic">bien-aimé(e)</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="relative rounded-3xl border border-border bg-card p-8 hover:shadow-elegant transition-all duration-500"
            >
              <div className="absolute top-6 right-6 font-serif text-5xl text-gold/20">
                0{i + 1}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary-soft grid place-items-center mb-6">
                <s.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-serif text-2xl text-foreground mb-3">{s.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Why() {
  const features = [
    {
      icon: ShieldCheck,
      title: "Vérification rigoureuse",
      desc: "Chaque profil est vérifié par pièce d'identité et selfie vidéo pour une communauté 100% authentique.",
    },
    {
      icon: Heart,
      title: "Compatibilité spirituelle",
      desc: "Un algorithme qui prend en compte votre dénomination, vos valeurs et votre projet de mariage.",
    },
    {
      icon: Church,
      title: "Ancré dans la foi",
      desc: "Versets, prières, témoignages : une plateforme qui célèbre Christ au cœur de vos rencontres.",
    },
    {
      icon: Lock,
      title: "Sécurité premium",
      desc: "Modération IA, données chiffrées, signalement instantané. Votre tranquillité est notre priorité.",
    },
    {
      icon: Users,
      title: "Communauté engagée",
      desc: "Témoignages, demandes de prière, encouragements : bien plus qu'une app, une famille en Christ.",
    },
    {
      icon: Crown,
      title: "Expérience premium",
      desc: "Une interface pensée comme les plus grandes apps mondiales. Élégante. Fluide. Inspirante.",
    },
  ];
  return (
    <section id="pourquoi" className="py-24 md:py-32 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Pourquoi AgapeMeet</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            La rencontre chrétienne <span className="italic">à sa juste valeur</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="rounded-3xl bg-card border border-border p-8 hover:border-gold/40 transition-all duration-500"
            >
              <div className="w-11 h-11 rounded-xl bg-gold-soft grid place-items-center mb-5">
                <f.icon className="w-5 h-5 text-gold-foreground" />
              </div>
              <h3 className="font-serif text-xl text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    {
      img: testimonial3,
      quote:
        "Nous nous sommes rencontrés sur AgapeMeet et mariés 14 mois plus tard. Dieu a écrit notre histoire d'une façon merveilleuse.",
      name: "Grâce & David",
      role: "Abidjan, mariés en 2024",
    },
    {
      img: testimonial1,
      quote:
        "Enfin une app où la foi n'est pas un détail. J'ai trouvé une communauté sincère et respectueuse.",
      name: "Esther, 28 ans",
      role: "Dakar",
    },
    {
      img: testimonial2,
      quote:
        "La vérification et la modération m'ont donné confiance dès le premier jour. Rien à voir avec les autres apps.",
      name: "Emmanuel, 32 ans",
      role: "Yaoundé",
    },
  ];
  return (
    <section id="temoignages" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Témoignages</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Des histoires <span className="italic">bénies</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="rounded-3xl overflow-hidden bg-card border border-border shadow-soft"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={t.img}
                  alt={t.name}
                  loading="lazy"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
              <figcaption className="p-6">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className="w-4 h-4 text-gold" fill="currentColor" />
                  ))}
                </div>
                <blockquote className="font-serif text-lg text-foreground leading-snug">
                  « {t.quote} »
                </blockquote>
                <p className="mt-4 text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Gratuit",
      price: "0€",
      period: "pour toujours",
      desc: "Découvrez la communauté et commencez votre voyage.",
      features: [
        "Profil complet",
        "Compatibilité de base",
        "Messagerie limitée",
        "Accès à la communauté",
      ],
      cta: "Commencer",
      highlight: false,
    },
    {
      name: "Alliance",
      price: "12,99€",
      period: "par mois",
      desc: "Pour ceux qui visent le mariage",
      features: [
        "Voir qui vous aime",
        "Likes & Super Likes illimités",
        "Retour arrière & Boost",
        "Filtres avancés",
        "Mode invisible",
        "Profil mis en avant",
      ],
      cta: "Devenir Premium",
      highlight: true,
    },
    {
      name: "Annuel",
      price: "89€",
      period: "par an",
      desc: "Le meilleur rapport pour un engagement sérieux.",
      features: [
        "Tous les avantages Premium",
        "Économisez 43%",
        "Coach spirituel dédié",
        "Événements exclusifs",
      ],
      cta: "Choisir annuel",
      highlight: false,
    },
  ];
  return (
    <section id="tarifs" className="py-24 md:py-32 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Tarifs</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Un plan pour <span className="italic">chaque histoire</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl p-8 border transition-all duration-500 flex flex-col ${
                p.highlight
                  ? "bg-primary text-primary-foreground border-primary shadow-elegant scale-[1.02]"
                  : "bg-card border-border hover:shadow-soft"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold text-gold-foreground text-xs font-medium px-3 py-1 shadow-soft">
                  Le plus choisi
                </div>
              )}
              <h3 className="font-serif text-2xl">{p.name}</h3>
              <p className={`mt-1 text-sm ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {p.desc}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-serif text-5xl font-semibold">{p.price}</span>
                <span className={`text-sm ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  / {p.period}
                </span>
              </div>
              <ul className="mt-8 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2
                      className={`w-4 h-4 mt-0.5 shrink-0 ${p.highlight ? "text-gold" : "text-success"}`}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/inscription"
                className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition ${
                  p.highlight
                    ? "bg-gold text-gold-foreground hover:bg-gold/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Qu'est-ce qui rend AgapeMeet différente ?",
      a: "AgapeMeet est exclusivement dédiée aux chrétiens qui recherchent un mariage. Notre algorithme intègre la foi et la dénomination, et chaque profil est vérifié manuellement.",
    },
    {
      q: "Est-ce vraiment gratuit ?",
      a: "Oui, vous pouvez créer votre profil, recevoir des propositions et échanger gratuitement. Le Premium débloque des fonctionnalités avancées pour aller plus loin.",
    },
    {
      q: "Comment garantissez-vous la sécurité ?",
      a: "Vérification d'identité, selfie vidéo, modération assistée par IA, signalement et blocage instantanés, données chiffrées. Votre sécurité passe avant tout.",
    },
    {
      q: "Qui peut s'inscrire ?",
      a: "Toute personne chrétienne majeure et célibataire, sincèrement engagée dans une démarche de rencontre en vue du mariage.",
    },
    {
      q: "Puis-je annuler à tout moment ?",
      a: "Bien sûr. Votre abonnement Premium se résilie en un clic, sans frais et sans engagement.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Questions</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Vos <span className="italic">interrogations</span>
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div
              key={f.q}
              className="rounded-2xl border border-border bg-card overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-secondary/40 transition"
              >
                <span className="font-medium text-foreground">{f.q}</span>
                <span
                  className={`w-6 h-6 rounded-full bg-primary-soft grid place-items-center text-primary transition-transform ${
                    open === i ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>
              {open === i && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="px-6 pb-5 text-muted-foreground leading-relaxed"
                >
                  {f.a}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="cta" className="py-24 md:py-32">
      <div className="max-w-5xl mx-auto px-6">
        <div className="relative rounded-[2.5rem] overflow-hidden p-10 md:p-16 text-center shadow-elegant"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, oklch(0.82 0.14 88) 0%, transparent 40%), radial-gradient(circle at 80% 80%, oklch(0.82 0.14 88) 0%, transparent 40%)",
            }}
          />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/20 px-3 py-1 text-xs text-primary-foreground mb-6">
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              Rejoignez plus de 120 000 chrétiens
            </div>
            <h2 className="font-serif text-4xl md:text-6xl text-primary-foreground leading-tight">
              Votre histoire commence
              <br />
              <span className="italic text-gradient-gold">aujourd'hui.</span>
            </h2>
            <p className="mt-6 text-primary-foreground/80 max-w-xl mx-auto text-lg">
              Créez votre profil en quelques minutes. C'est gratuit, sécurisé et centré sur ce qui compte.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                to="/inscription"
                className="inline-flex items-center gap-2 rounded-full bg-gold text-gold-foreground px-8 py-4 text-base font-medium hover:brightness-105 transition shadow-soft"
              >
                Commencer gratuitement
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#temoignages"
                className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 text-primary-foreground px-8 py-4 text-base font-medium hover:bg-primary-foreground/10 transition"
              >
                Lire les témoignages
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <img src={logoAsset} alt="AgapeMeet" className="w-10 h-10 object-contain" />
            <span className="font-serif text-xl font-semibold">
              Agape<span className="text-gold">Meet</span>
            </span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
            La plateforme premium de rencontres sérieuses chrétiennes. Là où la foi unit les cœurs, en
            Afrique francophone et à travers le monde.
          </p>
          <div className="mt-6 flex items-center gap-3">
            {[Instagram, Facebook, Twitter, Mail].map((I, k) => (
              <a
                key={k}
                href="#"
                className="w-9 h-9 rounded-full border border-border grid place-items-center text-muted-foreground hover:text-primary hover:border-primary transition"
                aria-label="Réseau social"
              >
                <I className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-medium text-foreground mb-4">Produit</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#comment" className="hover:text-foreground">Comment ça marche</a></li>
            <li><a href="#pourquoi" className="hover:text-foreground">Pourquoi nous</a></li>
            <li><a href="#tarifs" className="hover:text-foreground">Tarifs</a></li>
            <li><a href="#temoignages" className="hover:text-foreground">Témoignages</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-foreground mb-4">Entreprise</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-foreground">À propos</a></li>
            <li><a href="#" className="hover:text-foreground">Confidentialité</a></li>
            <li><a href="#" className="hover:text-foreground">Conditions</a></li>
            <li><a href="#" className="hover:text-foreground">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} AgapeMeet. Tous droits réservés.</p>
          <p className="italic font-serif">« Là où la foi unit les cœurs. »</p>
        </div>
      </div>
    </footer>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <Stats />
        <HowItWorks />
        <Why />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
