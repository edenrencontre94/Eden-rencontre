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

export const profiles: Profile[] = [];
export const recommendedProfiles: Profile[] = [];
export const newMembers: Profile[] = [];
export const mostCompatible: Profile[] = [];
export const verifiedProfiles: Profile[] = [];
export const premiumProfiles: Profile[] = [];
export const recentlyActive: Profile[] = [];

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

export const chats: Chat[] = [];

// Requests
export type MatchRequest = {
  id: string;
  profile: Profile;
  type: "like" | "superlike" | "match" | "invite" | "visit" | "pending";
  time: string;
};

export const requests: MatchRequest[] = [];

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

export const posts: Post[] = [];

export const coupleTestimonials: any[] = [];

export const verseOfTheDay = {
  ref: "Jérémie 29:11",
  text:
    "Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance.",
};

export const weeklyChallenge = {
  title: "Défi spirituel de la semaine",
  text: "Prier 10 minutes chaque matin pour votre futur(e) conjoint(e) et pour votre propre cœur.",
};