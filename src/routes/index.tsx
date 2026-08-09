import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart, ShieldCheck, Sparkles, BookOpen, Users, CheckCircle2, Star,
  ArrowRight, Church, HeartHandshake, Lock, Crown, Instagram, Facebook,
  Twitter, Mail, MessageCircle, Phone, Video, Image as ImageIcon,
  Play, Music, Smile, Gift, Bell, Eye, RefreshCw, Zap, Globe,
  ChevronDown,
} from "lucide-react";
import logoAsset from "@/assets/logo.png";
import { useState } from "react";
import heroCouple from "@/assets/hero-couple.jpg";
import testimonial1 from "@/assets/testimonial-1.jpg";
import testimonial2 from "@/assets/testimonial-2.jpg";
import testimonial3 from "@/assets/testimonial-3.jpg";
import { COUNTRIES } from "@/content/countries";
import { ARTICLES } from "@/content/articles";
import { WhatsAppButton, useSupportContact } from "@/components/SupportContact";
import { InstallBarTop, InstallSection, InstallPrompt } from "@/components/app/InstallPrompt";

/** Domaine canonique. Toute URL de référencement doit en découler. */
export const SITE_URL = "https://agapemeet.com";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgapeMeet — La rencontre chrétienne sérieuse №1 en Afrique francophone" },
      {
        name: "description",
        content:
          "AgapeMeet est la plateforme de rencontres chrétiennes sérieuses dédiée au mariage. Profils vérifiés, appels audio & vidéo, Stories, messagerie riche. Rejoignez 120 000 chrétiens en Afrique et dans le monde.",
      },
      { name: "keywords", content: "rencontre chrétienne, mariage chrétien, rencontres sérieuses chrétiens, application rencontre chrétienne Afrique, site de rencontre chrétien, rencontre foi, AgapeMeet" },
      { property: "og:title", content: "AgapeMeet — La rencontre chrétienne sérieuse №1 en Afrique francophone" },
      {
        property: "og:description",
        content: "Profils vérifiés, appels audio & vidéo avec votre match, Stories, GIFs, emojis, messagerie riche. Trouvez votre futur conjoint chrétien sur AgapeMeet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AgapeMeet — La rencontre chrétienne sérieuse №1 en Afrique francophone" },
      { name: "twitter:description", content: "Rencontres chrétiennes sérieuses. Profils vérifiés, appels vidéo, communauté chrétienne active. Rejoignez AgapeMeet gratuitement." },
      // og:url absolue, sinon les partages sociaux pointent dans le vide
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:site_name", content: "AgapeMeet" },
      { property: "og:locale", content: "fr_FR" },
      { property: "og:image", content: `${SITE_URL}/favicon.png` },
      { name: "twitter:image", content: `${SITE_URL}/favicon.png` },
    ],
    // ABSOLUE, impérativement. Un canonical relatif (« / ») se résout contre
    // l'URL courante : http://www.agapemeet.com/ se déclarait alors canonique
    // de lui-même, et Google indexait cette variante au lieu du vrai domaine.
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "AgapeMeet",
          applicationCategory: "SocialNetworkingApplication",
          description: "Plateforme de rencontres chrétiennes sérieuses en Afrique francophone et à l'international. Profils vérifiés, appels audio/vidéo, communauté chrétienne.",
          url: "/",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "XAF",
            description: "Inscription gratuite"
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.9",
            reviewCount: "3200",
          },
        }),
      },
    ],
  }),
  component: Index,
});

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* shrink-0 sur le logo : sans lui, flex comprime le nom de la
            plateforme pour laisser la place au bouton sur petit écran. */}
        <a href="#top" className="flex items-center gap-2 shrink-0">
          <img src={logoAsset} alt="AgapeMeet – rencontres chrétiennes sérieuses" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
          <span className="font-serif text-lg sm:text-xl font-semibold tracking-tight">
            Agape<span className="text-gold">Meet</span>
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground" aria-label="Navigation principale">
          <a href="#fonctionnalites" className="hover:text-foreground transition">Fonctionnalités</a>
          <a href="#comment" className="hover:text-foreground transition">Comment ça marche</a>
          <a href="#temoignages" className="hover:text-foreground transition">Témoignages</a>
          <Link to="/tarifs" className="hover:text-foreground transition">Tarifs</Link>
          <Link to="/blog" className="hover:text-foreground transition">Blog</Link>
          <Link to="/faq" className="hover:text-foreground transition">FAQ</Link>
        </nav>
        <Link
          to="/inscription"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3.5 sm:px-5 py-2 sm:py-2.5 text-sm font-medium hover:bg-primary/90 transition shadow-soft"
        >
          {/* Libellé court sur mobile : « Rejoindre gratuitement » occupait
              toute la largeur et écrasait le nom de la plateforme. */}
          <span className="sm:hidden">Rejoindre</span>
          <span className="hidden sm:inline">Rejoindre gratuitement</span>
          <ArrowRight className="w-4 h-4 hidden sm:block" />
        </Link>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="top" aria-label="Introduction AgapeMeet" className="relative pt-32 pb-20 md:pt-44 md:pb-36 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/40 via-background to-background" />
      <div className="absolute top-20 -left-40 w-96 h-96 rounded-full bg-gold/10 blur-3xl -z-10" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-soft px-3 py-1 text-xs font-medium text-gold-foreground mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Plateforme №1 de rencontres chrétiennes en Afrique francophone
          </div>
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-foreground">
            Votre âme sœur
            <br />
            vous attend <span className="italic text-gradient-gold">en Christ.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
            AgapeMeet est la première plateforme de rencontres chrétiennes sérieuses pensée pour le mariage.
            Des profils vérifiés, une communauté de foi vivante, et des outils de communication modernes
            pour bâtir une relation qui glorifie Dieu.
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
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-7 py-4 text-base font-medium hover:bg-secondary transition"
            >
              Se connecter
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Profils vérifiés</div>
            <div className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-emerald-500" /> 100% sécurisé</div>
            <div className="flex items-center gap-1.5"><Church className="w-4 h-4 text-emerald-500" /> Foi au centre</div>
            <div className="flex items-center gap-1.5"><Heart className="w-4 h-4 text-emerald-500" /> Mariage sérieux</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="relative"
        >
          <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden shadow-elegant">
            <img src={heroCouple} alt="Couple chrétien heureux trouvé sur AgapeMeet" className="w-full h-full object-cover" width={1400} height={1600} />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent" />
          </div>

          {/* Floating badge – compatibility */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }}
            className="absolute -left-4 md:-left-10 top-10 rounded-2xl bg-background shadow-elegant px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 grid place-items-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Compatibilité spirituelle</p>
              <p className="text-lg font-semibold text-foreground">98%</p>
            </div>
          </motion.div>

          {/* Floating badge – verse */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }}
            className="absolute -right-4 md:-right-6 bottom-16 rounded-2xl bg-background shadow-elegant px-4 py-3 flex items-center gap-3 max-w-[220px]">
            <div className="w-10 h-10 rounded-full bg-gold-soft grid place-items-center shrink-0">
              <BookOpen className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Verset du jour partagé</p>
              <p className="text-sm font-medium text-foreground leading-tight">« Eccl. 4:9 — Deux valent mieux qu'un »</p>
            </div>
          </motion.div>

          {/* Floating badge – match */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1, duration: 0.6 }}
            className="absolute left-4 -bottom-4 rounded-2xl bg-primary text-primary-foreground shadow-elegant px-4 py-3 flex items-center gap-3">
            <Heart className="w-5 h-5 text-gold fill-gold" />
            <div>
              <p className="text-xs opacity-80">Nouveau match !</p>
              <p className="text-sm font-semibold">Sarah, Abidjan 🇨🇮</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function Stats() {
  const stats = [
    { value: "120 000+", label: "Chrétiens inscrits", sub: "en Afrique & diaspora" },
    { value: "3 200+", label: "Mariages bénis", sub: "célébrés depuis 2022" },
    { value: "24 pays", label: "Présents dans", sub: "Afrique, Europe, Amériques" },
    { value: "4,9 / 5", label: "Note des membres", sub: "sur 8 000+ avis vérifiés" },
  ];
  return (
    <section className="border-y border-border/60 bg-secondary/40" aria-label="Chiffres clés AgapeMeet">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map(s => (
          <div key={s.label} className="text-center">
            <div className="font-serif text-3xl md:text-4xl font-semibold text-primary">{s.value}</div>
            <div className="mt-1 text-sm font-medium text-foreground">{s.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Messaging Feature (Big) ──────────────────────────────────────────────────
function MessagingFeature() {
  const features = [
    { icon: Phone, title: "Appels audio", desc: "Entendez sa voix avant même de vous rencontrer. Un appel audio sécurisé, directement depuis l'app, pour briser la glace avec douceur." },
    { icon: Video, title: "Appels vidéo", desc: "Face à face, les yeux dans les yeux. Les appels vidéo avec votre match créent une connexion réelle, sans avoir à partager votre numéro." },
    { icon: ImageIcon, title: "Envoi de photos & vidéos", desc: "Partagez vos moments de vie, vos sourires du dimanche, les photos de votre église — et laissez l'amour grandir naturellement." },
    { icon: Music, title: "Messages vocaux", desc: "Parfois, les mots écrits ne suffisent pas. Envoyez un vocal chaleureux, une prière douce ou une déclaration sincère." },
    { icon: Smile, title: "Emojis & GIFs", desc: "La joie s'exprime aussi en emojis ! Exprimez vos émotions, riez ensemble, et rendez chaque échange mémorable." },
    { icon: Gift, title: "Stickers chrétiens", desc: "Des stickers uniques inspirés de la foi : croix dorées, colombes, versets illustrés — pour sanctifier chaque conversation." },
  ];
  return (
    <section id="messagerie" aria-label="Fonctionnalités de messagerie AgapeMeet" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Messagerie ultra-riche</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Communiquez comme <span className="italic">jamais auparavant</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
            Fini les échanges fades et maladroits. Sur AgapeMeet, votre messagerie est un espace de connexion
            profonde — audio, vidéo, vocaux, photos, GIFs, emojis, stickers — tout ce dont vous avez besoin
            pour laisser votre cœur s'exprimer librement.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              className="rounded-3xl bg-card border border-border p-8 hover:border-primary/40 hover:shadow-elegant transition-all duration-500 group">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 grid place-items-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                <f.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
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

// ─── All Features ─────────────────────────────────────────────────────────────
function AllFeatures() {
  const features = [
    {
      icon: Sparkles,
      title: "Algorithme de compatibilité spirituelle",
      desc: "Notre moteur croise dénomination, valeurs, projet de mariage, localisation et personnalité. Résultat : des profils qui vous correspondent vraiment.",
      tag: "Exclusif"
    },
    {
      icon: Play,
      title: "Stories chrétiens",
      desc: "Partagez vos témoignages, vos versets du jour et vos moments de grâce en Stories visibles 24h. Soyez vu(e) par ceux qui vous cherchent.",
      tag: "Nouveau"
    },
    {
      icon: Eye,
      title: "Qui a vu votre profil",
      desc: "Avec Premium, découvrez exactement qui a consulté votre profil. Si leur cœur s'est tourné vers vous, ne le ratez pas.",
      tag: "Premium"
    },
    {
      icon: Zap,
      title: "Boost de profil",
      desc: "Propulsez votre profil en tête des découvertes pendant 30 minutes. Soyez vu par 10× plus de membres au moment où vous le décidez.",
      tag: "Premium"
    },
    {
      icon: Star,
      title: "Super Like",
      desc: "Un Super Like ne ment pas. Envoyez-en un à quelqu'un qui vous touche le cœur — il sait qu'il est spécial pour vous.",
      tag: ""
    },
    {
      icon: RefreshCw,
      title: "Retour arrière (Rewind)",
      desc: "Swipé trop vite ? Le Rewind vous permet de revenir sur le profil précédent. Parfois, la vie a besoin d'une seconde chance.",
      tag: "Premium"
    },
    {
      icon: ShieldCheck,
      title: "Profils vérifiés",
      desc: "Chaque profil est vérifié par pièce d'identité et selfie vidéo. Aucun faux compte, aucune surprise. Une communauté 100% authentique.",
      tag: ""
    },
    {
      icon: Globe,
      title: "Rencontres sans frontières",
      desc: "Côte d'Ivoire, Cameroun, Sénégal, Congo, France, Canada, Belgique… Votre futur conjoint peut être à l'autre bout du monde.",
      tag: ""
    },
    {
      icon: Bell,
      title: "Notifications intelligentes",
      desc: "On ne vous inonde pas. On vous alerte quand ça compte : un nouveau match, un message non lu, un Super Like reçu.",
      tag: ""
    },
    {
      icon: Users,
      title: "Communauté de foi active",
      desc: "Publiez témoignages, prières et encouragements. Commentez. Aimez. Sauvegardez. Signalez. Une communauté vivante qui grandit ensemble.",
      tag: "Nouveau"
    },
    {
      icon: BookOpen,
      title: "Verset & défi du jour",
      desc: "Chaque jour, un verset de la Parole pour nourrir votre foi. Un défi spirituel hebdomadaire pour rester ancré(e) dans ce qui compte.",
      tag: ""
    },
    {
      icon: Lock,
      title: "Mode invisible & confidentialité",
      desc: "Naviguez incognito. Bloquez et signalez en un instant. Vos données restent vos données — chiffrées, jamais revendues.",
      tag: "Premium"
    },
  ];

  return (
    <section id="fonctionnalites" aria-label="Toutes les fonctionnalités AgapeMeet" className="py-24 md:py-32 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Fonctionnalités</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Tout ce dont <span className="italic">votre cœur a besoin</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
            AgapeMeet n'est pas une app de rencontre de plus. C'est un écosystème complet pour rencontrer,
            communiquer, se découvrir et cheminer vers le mariage — le tout dans un cadre chrétien sécurisé.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="rounded-3xl bg-card border border-border p-7 hover:border-gold/40 transition-all duration-500 relative overflow-hidden">
              {f.tag && (
                <span className={`absolute top-5 right-5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  f.tag === "Premium" ? "bg-gold/10 text-gold" :
                  f.tag === "Nouveau" ? "bg-primary/10 text-primary" :
                  "bg-emerald-500/10 text-emerald-600"
                }`}>{f.tag}</span>
              )}
              <div className="w-11 h-11 rounded-xl bg-gold-soft grid place-items-center mb-5">
                <f.icon className="w-5 h-5 text-gold-foreground" />
              </div>
              <h3 className="font-serif text-lg text-foreground mb-2 pr-16">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      icon: Users,
      title: "1. Créez votre profil en 4 minutes",
      desc: "Parlez de vous, de votre foi, de votre dénomination, de vos critères pour un futur conjoint. Ajoutez vos plus belles photos. Votre profil devient votre vitrine.",
    },
    {
      icon: Heart,
      title: "2. Découvrez & swipez avec intention",
      desc: "Parcourez des profils compatibles grâce à notre algorithme spirituel. J'adore, Super Like, Passe — chaque geste est un pas vers votre histoire.",
    },
    {
      icon: MessageCircle,
      title: "3. Échangez en toute profondeur",
      desc: "Messages texte, vocaux, photos, appels audio ou vidéo — votre messagerie est un espace intime pour apprendre à vous connaître vraiment.",
    },
    {
      icon: HeartHandshake,
      title: "4. Bâtissez ensemble votre avenir",
      desc: "Priez, partagez des versets, témoignez dans la communauté. Et un jour, marchez côte à côte vers l'autel — et vers l'éternité.",
    },
  ];
  return (
    <section id="comment" aria-label="Comment fonctionne AgapeMeet" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Comment ça marche</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Quatre étapes vers <span className="italic">votre bien-aimé(e)</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6, delay: i * 0.1 }}
              className="relative rounded-3xl border border-border bg-card p-8 hover:shadow-elegant transition-all duration-500">
              <div className="absolute top-5 right-5 font-serif text-5xl text-gold/15">0{i + 1}</div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 grid place-items-center mb-6">
                <s.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-serif text-xl text-foreground mb-3">{s.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why AgapeMeet (Differentiators) ─────────────────────────────────────────
function Why() {
  return (
    <section id="pourquoi" aria-label="Pourquoi choisir AgapeMeet" className="py-24 md:py-32 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Notre différence</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Ce que personne d'autre <span className="italic">ne vous offre</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            AgapeMeet n'est pas une application généraliste avec une case «&nbsp;chrétien&nbsp;». C'est une plateforme construite de A à Z
            pour les hommes et femmes qui placent Dieu au cœur de leur vie amoureuse.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center mb-16">
          <div className="space-y-6">
            {[
              { icon: Church, title: "Foi, pas option — Foi, fondement", desc: "Sur AgapeMeet, votre dénomination, vos pratiques spirituelles et votre projet de vie en Christ sont au cœur de chaque recommandation. Vous êtes ici parmi les vôtres." },
              { icon: ShieldCheck, title: "Aucun faux profil. Promis.", desc: "Vérification par pièce d'identité + selfie vidéo obligatoire. Notre modération active bloque et supprime les comptes frauduleux sous 24h. Une sécurité digne des grandes plateformes mondiales." },
              { icon: HeartHandshake, title: "Orienté mariage, pas divertissement", desc: "Contrairement aux apps généralistes qui jouent avec vos émotions, AgapeMeet vous guide vers une relation sérieuse. Notre algorithme priorise la durabilité." },
              { icon: Globe, title: "Une diaspora africaine unie", desc: "De Douala à Paris, d'Abidjan à Montréal, de Dakar à Bruxelles — AgapeMeet connecte les chrétiens africains du monde entier, sans frontières." },
            ].map((item, i) => (
              <motion.div key={item.title} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-5 p-5 rounded-2xl bg-card border border-border hover:border-gold/40 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-gold-soft grid place-items-center shrink-0">
                  <item.icon className="w-5 h-5 text-gold-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="rounded-3xl bg-gradient-to-br from-primary to-primary/70 p-8 text-primary-foreground shadow-elegant">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              Notre philosophie
            </div>
            <h3 className="font-serif text-3xl md:text-4xl leading-tight mb-6">
              « Recherchez d'abord le Royaume de Dieu… <span className="italic text-gold">et tout le reste vous sera donné. »</span>
            </h3>
            <p className="text-primary-foreground/80 leading-relaxed mb-8">
              Matthieu 6:33. Ce verset guide tout ce que nous faisons. AgapeMeet croit profondément que quand deux
              personnes cherchent Dieu en premier, leur rencontre devient un miracle orchestré par Lui.
            </p>
            <Link to="/inscription" className="inline-flex items-center gap-2 bg-gold text-gold-foreground rounded-full px-6 py-3 text-sm font-semibold hover:brightness-105 transition">
              Commencer mon histoire <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function Testimonials() {
  const items = [
    {
      img: testimonial3,
      quote: "Nous nous sommes rencontrés sur AgapeMeet et mariés 14 mois plus tard. Dieu a écrit notre histoire d'une façon si merveilleuse. La vérification des profils m'avait mis en confiance dès le premier jour.",
      name: "Grâce & David",
      role: "Abidjan 🇨🇮 — Mariés en 2024",
    },
    {
      img: testimonial1,
      quote: "Enfin une application où la foi n'est pas un détail à cocher. J'ai trouvé une communauté sincère et respectueuse. Et surtout… j'ai trouvé l'homme que Dieu avait préparé pour moi.",
      name: "Esther M., 28 ans",
      role: "Dakar 🇸🇳",
    },
    {
      img: testimonial2,
      quote: "Les appels vidéo intégrés ont tout changé. Pas besoin d'échanger mon numéro au premier échange. J'ai pu apprendre à la connaître en sécurité, à mon rythme.",
      name: "Emmanuel K., 32 ans",
      role: "Yaoundé 🇨🇲",
    },
  ];
  return (
    <section id="temoignages" aria-label="Témoignages de membres AgapeMeet" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Témoignages</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Des histoires <span className="italic">écrites par Dieu</span>
          </h2>
          <p className="mt-4 text-muted-foreground">Plus de 3 200 couples formés. Voici quelques-uns de leurs témoignages.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <motion.figure key={t.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay: i * 0.1 }}
              className="rounded-3xl overflow-hidden bg-card border border-border shadow-soft hover:shadow-elegant transition-all duration-500">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={t.img} alt={`Témoignage AgapeMeet — ${t.name}`} loading="lazy"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
              </div>
              <figcaption className="p-6">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, k) => <Star key={k} className="w-4 h-4 text-gold" fill="currentColor" />)}
                </div>
                <blockquote className="font-serif text-base text-foreground leading-snug">« {t.quote} »</blockquote>
                <p className="mt-4 text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function Pricing() {
  const plans = [
    {
      name: "Gratuit",
      price: "0",
      currency: "FCFA",
      period: "pour toujours",
      desc: "Commencez votre voyage vers l'amour chrétien.",
      features: [
        "Profil complet & photos",
        "Découvrir des profils compatibles",
        "Swipe J'adore / Passe",
        "Messagerie de base",
        "Accès à la Communauté",
        "Verset du jour",
      ],
      cta: "Commencer gratuitement",
      highlight: false,
    },
    {
      name: "Premium",
      price: "9 990",
      currency: "FCFA",
      period: "/ mois",
      desc: "Pour ceux qui visent le mariage et ne laissent rien au hasard.",
      features: [
        "Voir qui a aimé votre profil",
        "Super Likes illimités",
        "Appels audio & vidéo illimités",
        "Stories chrétiens",
        "Retour arrière (Rewind)",
        "Boost de profil mensuel",
        "Filtres avancés (dénomination, ville…)",
        "Mode navigation invisible",
        "Badge Premium & profil mis en avant",
      ],
      cta: "Devenir Premium",
      highlight: true,
    },
    {
      name: "VIP",
      price: "1 500",
      currency: "FCFA",
      period: "/ jour",
      desc: "Un pass journalier pour les voyageurs et les curieux.",
      features: [
        "Tous les avantages Premium",
        "Accès 24h — sans engagement",
        "Parfait pour tester avant de s'abonner",
        "Boosts supplémentaires inclus",
      ],
      cta: "Essayer VIP 24h",
      highlight: false,
    },
  ];
  return (
    <section id="tarifs" aria-label="Tarifs et abonnements AgapeMeet" className="py-24 md:py-32 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Tarifs</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Un plan pour <span className="italic">chaque cœur</span>
          </h2>
          <p className="mt-4 text-muted-foreground">Commencez gratuitement. Passez Premium quand votre cœur est prêt.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map(p => (
            <div key={p.name} className={`relative rounded-3xl p-8 border transition-all duration-500 flex flex-col ${
              p.highlight ? "bg-primary text-primary-foreground border-primary shadow-elegant scale-[1.02]" : "bg-card border-border hover:shadow-soft"
            }`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold text-gold-foreground text-xs font-medium px-3 py-1 shadow-soft whitespace-nowrap">
                  ✦ Le plus choisi — Idéal mariage
                </div>
              )}
              <h3 className="font-serif text-2xl">{p.name}</h3>
              <p className={`mt-1 text-sm ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-serif text-4xl font-semibold">{p.price}</span>
                <span className={`text-sm ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {" "}{p.currency} {p.period}
                </span>
              </div>
              <ul className="mt-8 space-y-3 flex-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${p.highlight ? "text-gold" : "text-emerald-500"}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/inscription" className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${
                p.highlight ? "bg-gold text-gold-foreground hover:bg-gold/90" : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}>
                {p.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Blog Section ─────────────────────────────────────────────────────────────
function Blog() {
  const posts = [
    {
      tag: "Rencontre chrétienne",
      title: "5 questions spirituelles à poser avant le 3ème rendez-vous",
      excerpt: "Découvrez les questions essentielles pour évaluer la compatibilité spirituelle de votre partenaire potentiel, et éviter les déceptions.",
      date: "28 juil. 2026",
      readTime: "5 min",
    },
    {
      tag: "Mariage",
      title: "Comment savoir si c'est la personne que Dieu a choisie pour moi ?",
      excerpt: "Entre signes, paix intérieure et discernement biblique — un guide pratique pour les chrétiens en recherche d'un conjoint.",
      date: "20 juil. 2026",
      readTime: "7 min",
    },
    {
      tag: "Communauté",
      title: "Pourquoi les rencontres chrétiennes en ligne sont-elles différentes ?",
      excerpt: "L'application de rencontres chrétiennes n'est pas un compromis : c'est l'outil moderne que Dieu utilise pour rapprocher ses enfants.",
      date: "12 juil. 2026",
      readTime: "4 min",
    },
  ];

  return (
    <section id="blog" aria-label="Blog AgapeMeet — conseils rencontres chrétiennes" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-12 flex-wrap gap-4">
          <div>
            <p className="text-sm font-medium text-gold uppercase tracking-widest">Blog</p>
            <h2 className="mt-2 font-serif text-4xl md:text-5xl text-foreground">
              Sagesse pour <span className="italic">votre cœur</span>
            </h2>
          </div>
          <a href="#blog" className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline">
            Tous les articles <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {posts.map((post, i) => (
            <motion.article key={post.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-3xl bg-card border border-border p-7 hover:border-primary/40 hover:shadow-elegant transition-all duration-500 flex flex-col">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full mb-5 self-start">
                {post.tag}
              </div>
              <h3 className="font-serif text-xl text-foreground mb-3 leading-snug flex-1">{post.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">{post.excerpt}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-4 mt-auto">
                <span>{post.date}</span>
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {post.readTime} de lecture</span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function FAQ() {
  const faqs = [
    {
      q: "AgapeMeet est-elle réservée à une seule dénomination chrétienne ?",
      a: "Non ! AgapeMeet accueille tous les chrétiens sincères : protestants, catholiques, évangéliques, pentecôtistes, adventistes… Notre algorithme vous met en relation avec des personnes qui partagent vos valeurs profondes, quelle que soit votre dénomination.",
    },
    {
      q: "Comment fonctionne la vérification des profils ?",
      a: "Chaque membre doit passer par une vérification d'identité (pièce d'identité + selfie vidéo). Un profil non vérifié est clairement indiqué et a des accès limités. Notre équipe de modération traite les signalements sous 24h.",
    },
    {
      q: "Puis-je faire des appels vidéo et audio depuis l'app ?",
      a: "Absolument. C'est l'une de nos fonctionnalités phares. Vos appels audio et vidéo sont intégrés à la messagerie de l'app — sans partager votre numéro de téléphone, en toute sécurité.",
    },
    {
      q: "C'est vraiment gratuit ? Qu'est-ce qui est inclus ?",
      a: "Oui, l'inscription et les fonctions de base sont 100% gratuites : profil complet, swipe, messagerie simple, accès à la communauté et verset du jour. Le Premium débloque les appels, Stories, Boost, Rewind, et l'affichage des profils qui vous ont aimé(e).",
    },
    {
      q: "Est-ce disponible en dehors de l'Afrique ?",
      a: "Oui ! AgapeMeet est utilisé dans plus de 24 pays. France, Belgique, Canada, USA, UK et dans toute l'Afrique francophone. Nos membres de la diaspora trouvent souvent leur moitié dans un autre pays.",
    },
    {
      q: "Comment puis-je supprimer mon compte ?",
      a: "En un clic depuis les paramètres de l'application. Toutes vos données sont supprimées définitivement sous 30 jours, conformément au RGPD et aux lois locales de protection des données.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" aria-label="Foire aux questions AgapeMeet" className="py-24 md:py-32 bg-secondary/40">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-medium text-gold uppercase tracking-widest">Questions fréquentes</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            On répond à vos <span className="italic">questions</span>
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={f.q} className="rounded-2xl border border-border bg-card overflow-hidden transition-all">
              <button onClick={() => setOpen(open === i ? null : i)}
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-secondary/40 transition"
                aria-expanded={open === i}>
                <span className="font-medium text-foreground">{f.q}</span>
                <span className={`w-6 h-6 rounded-full bg-primary/10 grid place-items-center text-primary transition-transform shrink-0 ${open === i ? "rotate-45" : ""}`}>+</span>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="px-6 pb-5 text-muted-foreground leading-relaxed text-sm">{f.a}</motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section id="cta" aria-label="Rejoindre AgapeMeet" className="py-24 md:py-32">
      <div className="max-w-5xl mx-auto px-6">
        <div className="relative rounded-[2.5rem] overflow-hidden p-10 md:p-16 text-center shadow-elegant"
          style={{ backgroundImage: "var(--gradient-hero)" }}>
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "radial-gradient(circle at 20% 20%, oklch(0.82 0.14 88) 0%, transparent 40%), radial-gradient(circle at 80% 80%, oklch(0.82 0.14 88) 0%, transparent 40%)" }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/20 px-3 py-1 text-xs text-primary-foreground mb-6">
              <Sparkles className="w-3.5 h-3.5 text-gold" /> Plus de 120 000 chrétiens vous attendent
            </div>
            <h2 className="font-serif text-4xl md:text-6xl text-primary-foreground leading-tight">
              Votre histoire d'amour
              <br />
              <span className="italic text-gradient-gold">commence ici.</span>
            </h2>
            <p className="mt-6 text-primary-foreground/80 max-w-2xl mx-auto text-lg leading-relaxed">
              Gratuit. Sécurisé. Chrétien. AgapeMeet est la plateforme que vous attendiez —
              celle qui prend votre foi aussi au sérieux que votre désir d'aimer.
              Votre futur conjoint est peut-être déjà inscrit.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/inscription" className="inline-flex items-center gap-2 rounded-full bg-gold text-gold-foreground px-8 py-4 text-base font-semibold hover:brightness-105 transition shadow-soft">
                Créer mon profil gratuitement <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#temoignages" className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 text-primary-foreground px-8 py-4 text-base font-medium hover:bg-primary-foreground/10 transition">
                Lire les témoignages
              </a>
            </div>
            <p className="mt-6 text-xs text-primary-foreground/60">
              Inscription en 4 minutes · Sans carte bancaire · Annulable à tout moment
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
/**
 * Assistance en pied de page.
 *
 * Le numéro WhatsApp n'est pas écrit : un bouton ouvre directement la
 * conversation. Afficher les chiffres inviterait à les recopier à la main,
 * avec les fautes de frappe que cela suppose — et sur mobile, le clic
 * fonctionne, pas la sélection.
 */
function FooterContact() {
  const { email } = useSupportContact();

  return (
    <div className="space-y-2.5">
      <WhatsAppButton
        label="WhatsApp"
        compact
        message="Bonjour, je vous écris depuis le site AgapeMeet."
        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
      />
      {email && (
        <a
          href={`mailto:${email}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <Mail className="w-4 h-4 shrink-0" />
          <span className="truncate">{email}</span>
        </a>
      )}
    </div>
  );
}

function Footer() {
  return (
    <>
    {/* Pays couverts — ces liens sont le seul chemin par lequel Google
        découvrira les pages pays. Sans maillage depuis l'accueil, une page
        peut exister sans jamais être visitée par un robot. */}
    <section className="border-t border-border bg-background py-10" aria-label="Rencontres chrétiennes par pays">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-serif text-2xl font-semibold text-center">
          La rencontre chrétienne près de chez vous
        </h2>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Découvrez la communauté AgapeMeet dans votre pays.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {COUNTRIES.map(c => (
            <Link
              key={c.slug}
              to="/rencontre-chretienne/$pays"
              params={{ pays: c.slug }}
              className="px-4 py-2 rounded-full border border-border bg-card text-sm font-medium hover:border-primary/40 hover:text-primary transition"
            >
              {c.flag} {c.name}
            </Link>
          ))}
        </div>
      </div>
    </section>

    <footer className="border-t border-border bg-secondary/30" aria-label="Pied de page AgapeMeet">
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-5 gap-10">
        {/* Brand */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <img src={logoAsset} alt="AgapeMeet — rencontres chrétiennes" className="w-10 h-10 object-contain" />
            <span className="font-serif text-xl font-semibold">Agape<span className="text-gold">Meet</span></span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
            La plateforme de rencontres chrétiennes sérieuses pour le mariage.
            Là où la foi unit les cœurs, en Afrique francophone et dans le monde entier.
          </p>
          <p className="mt-3 text-xs text-muted-foreground italic font-serif">
            « L'Éternel Dieu dit : Il n'est pas bon que l'homme soit seul » — Genèse 2:18
          </p>
          <div className="mt-6 flex items-center gap-3">
            {[
              { Icon: Instagram, label: "Instagram AgapeMeet" },
              { Icon: Facebook, label: "Facebook AgapeMeet" },
              { Icon: Twitter, label: "Twitter AgapeMeet" },
              { Icon: Mail, label: "Contact AgapeMeet" },
            ].map(({ Icon, label }, k) => (
              <a key={k} href="#" aria-label={label}
                className="w-9 h-9 rounded-full border border-border grid place-items-center text-muted-foreground hover:text-primary hover:border-primary transition">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Product */}
        <div>
          <h4 className="font-semibold text-foreground mb-4 text-sm">Application</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><a href="#fonctionnalites" className="hover:text-foreground transition">Fonctionnalités</a></li>
            <li><a href="#comment" className="hover:text-foreground transition">Comment ça marche</a></li>
            <li><Link to="/tarifs" className="hover:text-foreground transition">Tarifs & Abonnements</Link></li>
            <li><a href="#temoignages" className="hover:text-foreground transition">Témoignages</a></li>
            <li><Link to="/login" className="hover:text-foreground transition">Se connecter</Link></li>
            <li><Link to="/inscription" className="hover:text-foreground transition">S'inscrire gratuitement</Link></li>
          </ul>
        </div>

        {/* Blog — liens vers de VRAIS articles. Des ancres « #blog » ne
            créaient aucune URL : rien n'était indexable ni découvrable. */}
        <div>
          <h4 className="font-semibold text-foreground mb-4 text-sm">Blog & Ressources</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {ARTICLES.map(a => (
              <li key={a.slug}>
                <Link to="/blog/$slug" params={{ slug: a.slug }} className="hover:text-foreground transition">
                  {a.title}
                </Link>
              </li>
            ))}
            <li><Link to="/blog" className="hover:text-foreground transition">Tous les articles</Link></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="font-semibold text-foreground mb-4 text-sm">Entreprise</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><Link to="/confidentialite" className="hover:text-foreground transition">Politique de confidentialité</Link></li>
            <li><Link to="/conditions" className="hover:text-foreground transition">Conditions d'utilisation</Link></li>
            <li><Link to="/faq" className="hover:text-foreground transition">FAQ</Link></li>
            <li><Link to="/tarifs" className="hover:text-foreground transition">Tarifs</Link></li>
          </ul>

          <h4 className="font-semibold text-foreground mt-8 mb-3 text-sm">Assistance</h4>
          <FooterContact />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} AgapeMeet. Tous droits réservés. — Rencontres chrétiennes sérieuses en Afrique francophone et dans le monde.</p>
          <p className="italic font-serif text-sm">« Là où la foi unit les cœurs. »</p>
        </div>
      </div>
    </footer>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* En haut : attrape celui qui ne fera jamais défiler la page. */}
      <InstallBarTop />
      <Nav />
      <main>
        <Hero />
        <Stats />
        <MessagingFeature />
        <AllFeatures />
        <HowItWorks />
        <Why />
        <Testimonials />
        <Pricing />
        <Blog />
        <FAQ />
        <FinalCTA />
        {/* Dans le flux, avant le pied de page : celui qui lit
            jusqu'ici est précisément celui qui est convaincu. */}
        <InstallSection />
      </main>
      <Footer />
      {/* Flottante, après une minute. */}
      <InstallPrompt />
    </div>
  );
}
