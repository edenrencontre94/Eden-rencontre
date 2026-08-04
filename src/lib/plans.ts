/**
 * Catalogue des formules AgapeMeet.
 *
 * Modèle retenu : vente de DURÉES en paiement unique (pas de prélèvement
 * récurrent), car Chariow ne gère que le paiement à l'acte. À l'expiration,
 * l'utilisateur rachète une durée. Un achat pendant une période active
 * PROLONGE la date de fin au lieu de l'écraser.
 */

export type PlanId = "gratuit" | "premium" | "vip";
export type DurationId = "15j" | "1m" | "3m";

export type PlanFeatures = {
  visitors: boolean;
  superLikesPerDay: number; // -1 = illimité
  boostsPerMonth: number; // -1 = illimité
  unlimitedLikes: boolean;
  advancedFilters: boolean;
  readReceipts: boolean;
  incognito: boolean;
  priorityVerification: boolean;
};

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
  /** Ce que la formule ne couvre pas — crée le contraste avec la suivante. */
  limits?: string[];
  features: PlanFeatures;
  highlight?: boolean;
};

export const FREE_FEATURES: PlanFeatures = {
  visitors: false,
  superLikesPerDay: 1,
  boostsPerMonth: 0,
  unlimitedLikes: false,
  advancedFilters: false,
  readReceipts: false,
  incognito: false,
  priorityVerification: false,
};

export const PLANS: Plan[] = [
  {
    id: "gratuit",
    name: "Gratuit",
    tagline: "Faites vos premiers pas",
    promise: "Découvrez la communauté à votre rythme, sans rien débourser.",
    perks: [
      "Un profil complet pour vous présenter tel que vous êtes",
      "20 likes par jour pour explorer sans précipitation",
      "1 Super Like quotidien, pour les profils qui vous touchent vraiment",
      "Messagerie, photos et appels illimités avec vos matchs",
      "Le verset du jour et toute la vie de la communauté",
    ],
    limits: [
      "Vous ne voyez pas qui visite votre profil",
      "Recherche limitée : ni confession, ni pratique, ni distance",
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
      "Découvrez qui visite votre profil — un intérêt sincère ne vous échappera plus",
      "Likes illimités : plus aucun frein pour trouver la bonne personne",
      "5 Super Likes par jour pour vous démarquer dès le premier regard",
      "Un Boost offert chaque mois : votre profil mis en avant",
      "Filtres avancés — confession, pratique, ville, distance",
      "Accusés de lecture : sachez quand votre message a été lu",
    ],
    features: {
      visitors: true,
      superLikesPerDay: 5,
      boostsPerMonth: 1,
      unlimitedLikes: true,
      advancedFilters: true,
      readReceipts: true,
      incognito: false,
      priorityVerification: false,
    },
  },
  {
    id: "vip",
    name: "VIP",
    tagline: "À l'image de l'amour inconditionnel de Dieu",
    promise: "Tout Premium, sans aucune limite — et quelqu'un à vos côtés.",
    perks: [
      "Tout ce que contient Premium, sans la moindre restriction",
      "Super Likes et Boosts illimités — soyez visible chaque jour",
      "Mode incognito : visitez les profils sans laisser de trace",
      "Vérification prioritaire de votre identité et de votre foi",
      "Le badge certifié qui inspire confiance au premier coup d'œil",
      "Mise en avant permanente auprès des profils les plus compatibles",
      "Un conseiller dédié pour vous accompagner jusqu'à la rencontre",
    ],
    features: {
      visitors: true,
      superLikesPerDay: -1,
      boostsPerMonth: -1,
      unlimitedLikes: true,
      advancedFilters: true,
      readReceipts: true,
      incognito: true,
      priorityVerification: true,
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
  {
    id: "vip_1m",
    planId: "vip",
    duration: "1m",
    label: "1 mois",
    days: 30,
    priceXOF: 12000,
  },
];

/**
 * Boosts à l'unité.
 *
 * Le Boost inclus dans Premium dure 30 minutes et se renouvelle chaque mois.
 * Ceux-ci s'achètent séparément, durent bien plus longtemps, et sont ouverts
 * à tous — y compris aux membres gratuits, pour qui c'est souvent la
 * première dépense.
 */
export type BoostOffer = {
  id: string;
  label: string;
  duration: string;
  hours: number;
  priceXOF: number;
  popular?: boolean;
};

export const BOOST_OFFERS: BoostOffer[] = [
  { id: "boost_24h", label: "Boost 24h", duration: "24 heures", hours: 24, priceXOF: 1000 },
  { id: "boost_3j", label: "Boost 3 jours", duration: "3 jours", hours: 72, priceXOF: 2000, popular: true },
  { id: "boost_7j", label: "Boost 7 jours", duration: "7 jours", hours: 168, priceXOF: 3500 },
];

export function getBoostOffer(id: string): BoostOffer | undefined {
  return BOOST_OFFERS.find(o => o.id === id);
}

/** Prix ramené à la journée — met en valeur les formules longues. */
export function boostPricePerDay(offer: BoostOffer) {
  return Math.round(offer.priceXOF / (offer.hours / 24));
}

/** Économie en % face au Boost 24h. */
export function boostSavings(offer: BoostOffer): number {
  const ref = BOOST_OFFERS[0];
  if (offer.id === ref.id) return 0;
  const refPerDay = ref.priceXOF / (ref.hours / 24);
  const mine = offer.priceXOF / (offer.hours / 24);
  return Math.max(0, Math.round((1 - mine / refPerDay) * 100));
}

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

/** Prix ramené au jour — sert à afficher l'économie réalisée sur les longues durées. */
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
