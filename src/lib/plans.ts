/**
 * Catalogue des formules Eden Rencontre.
 *
 * Modèle retenu : vente de DURÉES en paiement unique (pas de prélèvement
 * récurrent), car Chariow ne gère que le paiement à l'acte. À l'expiration,
 * l'utilisateur rachète une durée. Un achat pendant une période active
 * PROLONGE la date de fin au lieu de l'écraser.
 */

export type PlanId = "gratuit" | "premium";
export type DurationId = "15j" | "1m" | "3m";

/**
 * Droits d'une formule.
 *
 * Ces valeurs pilotent l'INTERFACE. Les limites qui comptent vraiment
 * (messages, likes, Super Likes, appels, médias, visibilité) sont en plus
 * imposées par des triggers en base – voir 26_limites_gratuit.sql. Sans
 * cette double barrière, il suffirait d'appeler l'API depuis la console.
 */
export type PlanFeatures = {
  /** Voir réellement les visiteurs (le gratuit n'a qu'un aperçu flouté) */
  visitors: boolean;
  /**
   * Consulter l'onglet Super Likes reçus.
   *
   * Ne couvre plus « M'ont aimé », désormais ouvert à tous : verrouiller
   * cet onglet sur un compte neuf – qui n'a encore aucun match – ne
   * laissait qu'un écran vide et un cadenas, au moment précis où il faut
   * donner une raison de revenir.
   */
  seeAdmirers: boolean;
  superLikesPerDay: number; // -1 = illimité
  /** Délai entre deux Super Likes, en jours (0 = pas de délai) */
  superLikeCooldownDays: number;
  /** Likes quotidiens : -1 = illimité */
  dailyLikes: number;
  /** Messages envoyés par jour : -1 = illimité */
  dailyMessages: number;
  unlimitedLikes: boolean;
  advancedFilters: boolean;
  readReceipts: boolean;
  incognito: boolean;
  priorityVerification: boolean;
  /** Messages vocaux */
  voiceMessages: boolean;
  /** Appels audio et vidéo */
  calls: boolean;
  /** Bouton Retour (annuler le dernier swipe) */
  rewind: boolean;
  /** Bouton Message avant le match */
  preMatchMessage: boolean;
  /** Régler la visibilité de son profil */
  visibilityControl: boolean;
  /** Publier des photos dans la communauté */
  communityMedia: boolean;
  /** Publier des vidéos dans la communauté */
  communityVideo: boolean;
  /** Envoyer une vidéo en conversation */
  videoMessages: boolean;
  /** Appel vidéo */
  videoCalls: boolean;
  /** Vidéo de présentation sur le profil */
  profileVideo: boolean;
  /** Assistant coach IA */
  aiCoach: boolean;
};

/** Palier : 0 = gratuit, 1 = 15 j, 2 = 1 mois, 3 = 3 mois. */
export type PlanLevel = 0 | 1 | 2 | 3;

/** Messages par jour selon le palier. -1 = illimité. */
export const MESSAGES_BY_LEVEL: Record<PlanLevel, number> = {
  0: 5, 1: 20, 2: 35, 3: -1,
};

export const LEVEL_LABELS: Record<PlanLevel, string> = {
  0: "Gratuit",
  1: "Premium 15 jours",
  2: "Premium 1 mois",
  3: "Premium 3 mois",
};

/**
 * Droits effectifs, ajustés au palier réellement acheté.
 *
 * Les quotas de messages varient d'un palier Premium à
 * l'autre ; tout le reste dépend seulement de la formule.
 */
export function featuresFor(planId: PlanId, level: PlanLevel): PlanFeatures {
  const base = planId === "gratuit" ? FREE_FEATURES : getPlan(planId).features;
  return {
    ...base,
    dailyMessages: MESSAGES_BY_LEVEL[level] ?? base.dailyMessages,
  };
}

export type Offer = {
  id: string; // identifiant interne, sert de clé côté base
  planId: PlanId;
  duration: DurationId;
  label: string;
  days: number;
  priceXOF: number;
  popular?: boolean;
};
// Les identifiants produits Chariow (prd_…) ne vivent QUE côté serveur,
// dans les secrets de l'Edge Function : le client n'envoie que `offerId`.

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Promesse en une ligne, affichée en tête de carte. */
  promise: string;
  perks: string[];
  /** Ce que la formule ne couvre pas – crée le contraste avec la suivante. */
  limits?: string[];
  features: PlanFeatures;
  highlight?: boolean;
};

export const FREE_FEATURES: PlanFeatures = {
  visitors: false,
  seeAdmirers: false,
  superLikesPerDay: 1,
  superLikeCooldownDays: 7,
  dailyLikes: 25,
  dailyMessages: 5,
  unlimitedLikes: false,
  advancedFilters: false,
  readReceipts: false,
  incognito: false,
  priorityVerification: false,
  voiceMessages: false,
  calls: false,
  rewind: false,
  preMatchMessage: false,
  visibilityControl: false,
  communityMedia: false,
  communityVideo: false,
  videoMessages: false,
  videoCalls: false,
  profileVideo: false,
  aiCoach: false,
};

const PAID_BASE = {
  visitors: true,
  seeAdmirers: true,
  superLikeCooldownDays: 0,
  dailyLikes: -1,
  dailyMessages: -1,
  unlimitedLikes: true,
  advancedFilters: true,
  readReceipts: true,
  voiceMessages: true,
  calls: true,
  rewind: true,
  preMatchMessage: true,
  visibilityControl: true,
  communityMedia: true,
  // Tout ce qui touche à la vidéo, plus le coach IA
  communityVideo: true,
  videoMessages: true,
  videoCalls: true,
  profileVideo: true,
  aiCoach: true,
} as const;

export const PLANS: Plan[] = [
  {
    id: "gratuit",
    name: "Gratuit",
    tagline: "Faites vos premiers pas",
    promise: "Découvrez la communauté à votre rythme, sans rien débourser.",
    perks: [
      "Un profil complet pour vous présenter tel que vous êtes",
      "25 likes par jour pour explorer sans précipitation",
      "1 Super Like par semaine, pour les profils qui vous touchent vraiment",
      "5 messages par jour avec vos matchs",
      // Ouvert à tous depuis que « M'ont aimé » n'est plus verrouillé :
      // c'est ce qui donne envie de revenir, et l'annoncer ici évite de
      // le faire découvrir par hasard.
      "Voir qui vous a aimé",
      "Le verset du jour et la vie de la communauté",
    ],
    limits: [
      "Vous ne voyez pas qui a visité votre profil, ni vos Super Likes reçus",
      "Ni appels audio ou vidéo, ni messages vocaux",
      "Publications sans photo ni vidéo",
      "Ni filtres avancés, ni réglage de visibilité",
    ],
    features: FREE_FEATURES,
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Pour celles et ceux qui avancent vers le mariage",
    promise: "Ne laissez plus passer la bonne personne faute d'être vu.",
    highlight: true,
    perks: [
      "Découvrez qui visite votre profil – un intérêt sincère ne vous échappera plus",
      "Likes illimités : plus aucun frein pour trouver la bonne personne",
      "5 Super Likes par jour pour vous démarquer dès le premier regard",
      "Filtres avancés – confession, pratique, ville, distance",
      "Accusés de lecture : sachez quand votre message a été lu",
    ],
    features: {
      ...PAID_BASE,
      superLikesPerDay: 5,
      incognito: false,
      priorityVerification: false,
    },
  },
];

export const OFFERS: Offer[] = [
  {
    id: "premium_15j",
    planId: "premium",
    duration: "15j",
    label: "15 jours",
    days: 15,
    priceXOF: 2500,
  },
  {
    id: "premium_1m",
    planId: "premium",
    duration: "1m",
    label: "1 mois",
    days: 30,
    priceXOF: 4000,
    popular: true,
  },
  {
    id: "premium_3m",
    planId: "premium",
    duration: "3m",
    label: "3 mois",
    days: 90,
    priceXOF: 10500,
  },
];


export function getPlan(id: PlanId): Plan {
  return PLANS.find(p => p.id === id) ?? PLANS[0];
}

export function offersFor(planId: PlanId): Offer[] {
  return OFFERS.filter(o => o.planId === planId);
}

export function getOffer(offerId: string): Offer | undefined {
  return OFFERS.find(o => o.id === offerId);
}

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

/** Prix ramené au jour – sert à afficher l'économie réalisée sur les longues durées. */
export function pricePerDay(offer: Offer) {
  return Math.round(offer.priceXOF / offer.days);
}

/** Économie en % par rapport au tarif journalier de la formule 1 mois. */
export function savingsVsMonthly(offer: Offer): number {
  const monthly = OFFERS.find(o => o.planId === offer.planId && o.duration === "1m");
  if (!monthly || monthly.id === offer.id) return 0;
  const ref = monthly.priceXOF / monthly.days;
  const mine = offer.priceXOF / offer.days;
  return Math.max(0, Math.round((1 - mine / ref) * 100));
}
