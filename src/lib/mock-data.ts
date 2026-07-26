export type Profile = {
  id: string;
  firstName: string;
  age: number;
  city: string;
  country: string;
  denomination: string;
  compatibility: number;
  verified: boolean;
  premium: boolean;
  lastActive: string;
  photo: string;
  photos: string[];
  bio: string;
  profession: string;
  education: string;
  height: string;
  languages: string[];
  interests: string[];
  passions: string[];
  marriageVision: string;
  favoriteVerse: string;
  church: string;
  faithImportance: string;
};

const pic = (seed: string, w = 800) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=${w}&q=80`;

// Curated portrait photos (Unsplash IDs)
const portraits = [
  "1531123897727-8f129e1688ce",
  "1502823403499-6ccfcf4fb453",
  "1544005313-94ddf0286df2",
  "1519085360753-af0119f7cbe7",
  "1524504388940-b1c1722653e1",
  "1508214751196-bcfd4ca60f91",
  "1487412720507-e7ab37603c6f",
  "1517841905240-472988babdf9",
  "1541823709867-1b206113eafd",
  "1573496359142-b8d87734a5a2",
  "1506794778202-cad84cf45f1d",
  "1500648767791-00dcc994a43e",
];

const names = [
  { f: "Grâce", g: "F" },
  { f: "Emmanuel", g: "H" },
  { f: "Esther", g: "F" },
  { f: "David", g: "H" },
  { f: "Ruth", g: "F" },
  { f: "Josué", g: "H" },
  { f: "Déborah", g: "F" },
  { f: "Samuel", g: "H" },
  { f: "Marie", g: "F" },
  { f: "Daniel", g: "H" },
  { f: "Priscille", g: "F" },
  { f: "Ézéchiel", g: "H" },
];

const cities = [
  { c: "Abidjan", p: "Côte d'Ivoire" },
  { c: "Dakar", p: "Sénégal" },
  { c: "Yaoundé", p: "Cameroun" },
  { c: "Cotonou", p: "Bénin" },
  { c: "Lomé", p: "Togo" },
  { c: "Kinshasa", p: "RD Congo" },
  { c: "Paris", p: "France" },
  { c: "Montréal", p: "Canada" },
  { c: "Bruxelles", p: "Belgique" },
  { c: "Libreville", p: "Gabon" },
  { c: "Bamako", p: "Mali" },
  { c: "Ouagadougou", p: "Burkina Faso" },
];

const denominations = [
  "Catholique",
  "Évangélique",
  "Pentecôtiste",
  "Baptiste",
  "Méthodiste",
  "Adventiste",
];

const professions = [
  "Ingénieure logicielle",
  "Médecin",
  "Enseignante",
  "Entrepreneure",
  "Avocate",
  "Pasteur",
  "Infirmier",
  "Architecte",
  "Comptable",
  "Designer",
  "Consultant",
  "Chef de projet",
];

const interestsPool = [
  "Louange",
  "Lecture",
  "Voyages",
  "Cuisine",
  "Sport",
  "Musique",
  "Cinéma",
  "Bénévolat",
  "Nature",
  "Photographie",
  "Danse",
  "Café",
];

const passionsPool = [
  "Évangélisation",
  "Missions",
  "Enseignement biblique",
  "Aide humanitaire",
  "Musique gospel",
  "Étude théologique",
  "Prière",
  "Mentorat",
];

const verses = [
  "Jérémie 29:11",
  "Philippiens 4:13",
  "Proverbes 3:5-6",
  "Psaume 23",
  "Romains 8:28",
  "1 Corinthiens 13",
  "Ésaïe 41:10",
  "Matthieu 6:33",
];

const lastActives = [
  "En ligne",
  "Il y a 5 min",
  "Il y a 30 min",
  "Il y a 2 h",
  "Aujourd'hui",
  "Hier",
  "Il y a 2 j",
];

function seeded(i: number) {
  const name = names[i % names.length];
  const city = cities[i % cities.length];
  const photo = pic(portraits[i % portraits.length]);
  const photos = Array.from({ length: 6 }).map((_, k) =>
    pic(portraits[(i + k) % portraits.length]),
  );
  return {
    id: `p-${i}`,
    firstName: name.f,
    age: 22 + ((i * 3) % 15),
    city: city.c,
    country: city.p,
    denomination: denominations[i % denominations.length],
    compatibility: 72 + ((i * 7) % 27),
    verified: i % 3 !== 0,
    premium: i % 4 === 0,
    lastActive: lastActives[i % lastActives.length],
    photo,
    photos,
    bio:
      "Passionnée par Christ et par la vie. Je crois que Dieu a un plan magnifique pour chacun d'entre nous.",
    profession: professions[i % professions.length],
    education: ["Licence", "Master", "Doctorat", "Bac +2"][i % 4],
    height: `${160 + (i % 25)} cm`,
    languages: ["Français", i % 2 ? "Anglais" : "Espagnol"],
    interests: interestsPool.slice((i % 4), (i % 4) + 5),
    passions: passionsPool.slice((i % 3), (i % 3) + 3),
    marriageVision:
      "Bâtir un foyer centré sur Christ, dans l'amour, la prière et le service.",
    favoriteVerse: verses[i % verses.length],
    church: ["Église Nouvelle Vie", "Assemblée de Dieu", "Impact Centre Chrétien", "Vie Abondante"][i % 4],
    faithImportance: ["Essentielle", "Très importante", "Fondamentale"][i % 3],
  } satisfies Profile;
}

export const profiles: Profile[] = Array.from({ length: 24 }).map((_, i) => seeded(i));

export const recommendedProfiles = profiles.slice(0, 8);
export const newMembers = profiles.slice(8, 14);
export const mostCompatible = [...profiles]
  .sort((a, b) => b.compatibility - a.compatibility)
  .slice(0, 6);
export const verifiedProfiles = profiles.filter((p) => p.verified).slice(0, 6);
export const premiumProfiles = profiles.filter((p) => p.premium).slice(0, 6);
export const recentlyActive = profiles.filter((p) => p.lastActive === "En ligne" || p.lastActive.includes("min")).slice(0, 6);

// Messages
export type Chat = {
  id: string;
  profile: Profile;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  typing?: boolean;
};

export const chats: Chat[] = profiles.slice(0, 8).map((p, i) => ({
  id: `c-${i}`,
  profile: p,
  lastMessage: [
    "Que Dieu te bénisse abondamment !",
    "J'ai adoré notre conversation d'hier 😊",
    "Quel est ton verset préféré ?",
    "On se retrouve dimanche à l'église ?",
    "Merci pour ta prière 🙏",
    "Bonne journée à toi !",
    "Tu es libre ce week-end ?",
    "J'ai partagé un témoignage sur la communauté.",
  ][i],
  time: ["09:24", "Hier", "Lun", "Dim", "12:03", "08:15", "Sam", "Ven"][i],
  unread: i < 3 ? i + 1 : 0,
  online: i % 2 === 0,
  typing: i === 0,
}));

// Requests
export type MatchRequest = {
  id: string;
  profile: Profile;
  type: "like" | "superlike" | "match" | "invite" | "visit" | "pending";
  time: string;
};

export const requests: MatchRequest[] = profiles.slice(0, 18).map((p, i) => ({
  id: `r-${i}`,
  profile: p,
  type: (["like", "superlike", "match", "invite", "visit", "pending"] as const)[i % 6],
  time: ["Il y a 2 h", "Hier", "Il y a 3 j", "Il y a 1 h", "Aujourd'hui", "Il y a 5 min"][i % 6],
}));

// Community
export type Post = {
  id: string;
  author: Profile;
  category:
    | "Témoignage"
    | "Prière"
    | "Encouragement"
    | "Verset"
    | "Conseil"
    | "Réflexion"
    | "Question"
    | "Expérience";
  time: string;
  text: string;
  image?: string;
  likes: number;
  comments: number;
  shares: number;
  liked?: boolean;
  saved?: boolean;
};

const postSeeds: Array<Pick<Post, "category" | "text" | "image">> = [
  {
    category: "Témoignage",
    text: "Après des années de prière, Dieu m'a fait rencontrer mon époux sur AgapeMeet. Sa fidélité est immense — persévérez, votre saison vient !",
    image: pic(portraits[0], 1200),
  },
  {
    category: "Prière",
    text: "Merci de prier pour ma sœur qui traverse une période difficile. Que la paix de Dieu la couvre.",
  },
  {
    category: "Verset",
    text: "« L'Éternel est mon berger : je ne manquerai de rien. » — Psaume 23:1",
    image: pic(portraits[3], 1200),
  },
  {
    category: "Encouragement",
    text: "Ne te lasse pas de faire le bien. Au temps convenable, tu récolteras si tu ne te relâches pas. (Galates 6:9)",
  },
  {
    category: "Réflexion",
    text: "L'attente n'est pas un vide, c'est une préparation. Dieu façonne notre cœur avant de nous confier une nouvelle saison.",
  },
  {
    category: "Question",
    text: "Comment vivez-vous la patience dans le célibat sans perdre l'espérance ? Vos partages sont les bienvenus 🙏",
  },
];

export const posts: Post[] = postSeeds.map((s, i) => ({
  id: `post-${i}`,
  author: profiles[i + 2],
  time: ["Il y a 2 h", "Hier", "Il y a 3 j", "Il y a 5 h", "Aujourd'hui", "Il y a 1 j"][i],
  likes: 24 + i * 17,
  comments: 3 + i * 4,
  shares: 1 + i,
  liked: i === 0,
  saved: i === 2,
  ...s,
}));

export const coupleTestimonials = [
  {
    id: "ct-1",
    names: "Ruth & Samuel",
    city: "Abidjan",
    photo: pic("1519741497674-611481863552", 1200),
    text: "Mariés en juin dernier — rencontrés sur AgapeMeet après 3 mois d'échange.",
  },
  {
    id: "ct-2",
    names: "Esther & David",
    city: "Dakar",
    photo: pic("1583939003579-730e3918a45a", 1200),
    text: "Nous célébrons 1 an de mariage. À Dieu soit la gloire !",
  },
];

export const verseOfTheDay = {
  ref: "Jérémie 29:11",
  text:
    "Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance.",
};

export const weeklyChallenge = {
  title: "Défi spirituel de la semaine",
  text: "Prier 10 minutes chaque matin pour votre futur(e) conjoint(e) et pour votre propre cœur.",
};