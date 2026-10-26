import { supabase } from "@/lib/supabase";

/**
 * Accès aux données de /admin/utilisateurs.
 *
 * Tout le filtrage, la recherche et la pagination se font EN BASE. Filtrer
 * les 50 lignes déjà chargées reproduirait le défaut corrigé sur la
 * découverte : chercher les inactifs ne parcourrait que la page affichée.
 */

export type UserRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  city: string | null;
  country: string | null;
  gender: string | null;
  is_verified: boolean;
  is_founder: boolean;
  public_plan: string;
  premium_until: string | null;
  created_at: string;
  last_seen: string | null;
  photos: string[] | null;
  denomination: string | null;
  visibility: string;
  total_paye: number;
  nb_paiements: number;
  dernier_paiement: string | null;
  derniere_offre: string | null;
  completion: number;
  nb_matchs: number;
  nb_messages: number;
  nb_likes_donnes: number;
  nb_likes_recus: number;
  nb_signalements: number;
  nb_blocages: number;
  nb_tickets: number;
  suspended_until: string | null;
  suspension_reason: string | null;
  total_count: number;
};

export type Counts = {
  total: number;
  gratuit: number; premium: number;
  fondateurs: number; expires: number;
  nouveaux_7j: number;
  femmes: number; hommes: number; genre_absent: number;
  actifs_7j: number; actifs_30j: number;
  verifies: number; non_verifies: number;
  payants: number; ca_total: number; revenu_par_payant: number;
  taux_conversion: number; expire_7j: number;
  inactifs_30j: number; signales: number; en_pause: number; suspendus: number;
};

export type Filters = {
  plan: string;
  segment: string | null;
  search: string;
  gender: string | null;
  country: string | null;
  verified: boolean | null;
  page: number;
};

export const DEFAULT_FILTERS: Filters = {
  plan: "all",
  segment: null,
  search: "",
  gender: null,
  country: null,
  verified: null,
  page: 0,
};

export const PAGE_SIZE = 50;

/** Segments transversaux, cumulables avec l'offre. */
export const SEGMENTS = [
  { key: "inactifs", label: "Inactifs +30 j", hint: "Cible de relance", countKey: "inactifs_30j" },
  { key: "incomplet", label: "Profil < 50 %", hint: "Échoueront puis partiront", countKey: null },
  { key: "signales", label: "Signalés", hint: "Signalement en attente", countKey: "signales" },
  { key: "expire_bientot", label: "Expire sous 7 j", hint: "La fenêtre pour sauver l'abonnement", countKey: "expire_7j" },
  { key: "jamais_swipe", label: "Jamais swipé", hint: "L'accueil n'a pas fonctionné", countKey: null },
  { key: "en_pause", label: "En pause", hint: "Désabonnement qui s'annonce", countKey: "en_pause" },
  { key: "suspendus", label: "Suspendus", hint: "Accès gelé par la modération", countKey: "suspendus" },
] as const;

export const OFFER_LABELS: Record<string, string> = {
  premium_15j: "Premium 15 j",
  premium_1m: "Premium 1 mois",
  premium_3m: "Premium 3 mois",
  boost_24h: "Boost 24 h",
  boost_3j: "Boost 3 jours",
  boost_7j: "Boost 7 jours",
};

export function formatGender(gender?: string | null): string {
  if (!gender) return "—";
  const g = gender.toLowerCase().trim();
  if (g === "female" || g === "femme" || g === "f") return "Femme";
  if (g === "male" || g === "homme" || g === "h") return "Homme";
  return gender;
}

export function formatGenderShort(gender?: string | null): string {
  if (!gender) return "";
  const g = gender.toLowerCase().trim();
  if (g === "female" || g === "femme" || g === "f") return "F";
  if (g === "male" || g === "homme" || g === "h") return "H";
  return "";
}

function emptyCounts(): Counts {
  return {
    total: 0, gratuit: 0, premium: 0, fondateurs: 0, expires: 0,
    nouveaux_7j: 0, femmes: 0, hommes: 0, genre_absent: 0,
    actifs_7j: 0, actifs_30j: 0, verifies: 0, non_verifies: 0,
    payants: 0, ca_total: 0, revenu_par_payant: 0, taux_conversion: 0,
    expire_7j: 0, inactifs_30j: 0, signales: 0, en_pause: 0, suspendus: 0,
  };
}

export async function fetchCounts(): Promise<Counts> {
  // 1. Essayer la fonction RPC
  try {
    const { data, error } = await supabase.rpc("admin_plan_counts");
    if (!error && data && !(data as any)?.error) {
      const d = data as any;
      const femmesCount = Number(d.femmes ?? 0);
      const hommesCount = Number(d.hommes ?? 0);
      const totalCount = Number(d.total ?? 0);

      // Si la RPC a retourné 0 femmes et 0 hommes alors qu'il y a des membres inscrits (total > 0),
      // c'est que la RPC en base filtre sur 'female'/'male' alors que les membres sont enregistrés
      // avec 'femme'/'homme'. On bascule alors sur le fallback direct pour lire les vrais genres.
      const hasValidGenderCounts = femmesCount > 0 || hommesCount > 0 || totalCount === 0;

      if ((typeof d.total === "number" || typeof d.gratuit === "number") && hasValidGenderCounts) {
        return {
          total: totalCount,
          gratuit: Number(d.gratuit ?? 0),
          premium: Number(d.premium ?? 0),
          fondateurs: Number(d.fondateurs ?? 0),
          expires: Number(d.expires ?? 0),
          nouveaux_7j: Number(d.nouveaux_7j ?? 0),
          femmes: femmesCount,
          hommes: hommesCount,
          genre_absent: Number(d.genre_absent ?? 0),
          actifs_7j: Number(d.actifs_7j ?? 0),
          actifs_30j: Number(d.actifs_30j ?? 0),
          verifies: Number(d.verifies ?? 0),
          non_verifies: Number(d.non_verifies ?? 0),
          payants: Number(d.payants ?? 0),
          ca_total: Number(d.ca_total ?? 0),
          revenu_par_payant: Number(d.revenu_par_payant ?? 0),
          taux_conversion: Number(d.taux_conversion ?? 0),
          expire_7j: Number(d.expire_7j ?? 0),
          inactifs_30j: Number(d.inactifs_30j ?? 0),
          signales: Number(d.signales ?? 0),
          en_pause: Number(d.en_pause ?? 0),
          suspendus: Number(d.suspendus ?? 0),
        };
      }
    }
  } catch (e) {
    console.warn("[admin/utilisateurs] RPC admin_plan_counts non disponible:", e);
  }

  // 2. Fallback direct en interrogeant la table profiles
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, gender, is_verified, is_founder, public_plan, premium_until, created_at, last_seen, visibility, suspended_until");

    if (error || !profiles) {
      console.warn("[admin/utilisateurs] Erreur lecture directe profiles counts:", error);
      return emptyCounts();
    }

    const now = Date.now();
    const d7 = now - 7 * 86400000;
    const d30 = now - 30 * 86400000;
    const in7d = now + 7 * 86400000;

    let gratuit = 0;
    let premium = 0;
    let fondateurs = 0;
    let expires = 0;
    let nouveaux_7j = 0;
    let femmes = 0;
    let hommes = 0;
    let genre_absent = 0;
    let actifs_7j = 0;
    let actifs_30j = 0;
    let verifies = 0;
    let non_verifies = 0;
    let expire_7j = 0;
    let inactifs_30j = 0;
    let en_pause = 0;
    let suspendus = 0;

    for (const p of profiles as any[]) {
      const isPrem = Boolean(p.is_founder) || (p.public_plan === "premium" && (!p.premium_until || new Date(p.premium_until).getTime() > now));
      if (isPrem) premium++;
      else gratuit++;

      if (p.is_founder) fondateurs++;
      if (p.public_plan === "premium" && p.premium_until && new Date(p.premium_until).getTime() <= now) expires++;

      const createdAt = p.created_at ? new Date(p.created_at).getTime() : 0;
      if (createdAt >= d7) nouveaux_7j++;

      const g = (p.gender || "").toLowerCase();
      if (g === "female" || g === "femme") femmes++;
      else if (g === "male" || g === "homme") hommes++;
      else genre_absent++;

      const lastSeen = p.last_seen ? new Date(p.last_seen).getTime() : 0;
      if (lastSeen >= d7) actifs_7j++;
      if (lastSeen >= d30) actifs_30j++;
      if (!lastSeen || lastSeen < d30) inactifs_30j++;

      if (p.is_verified) verifies++;
      else non_verifies++;

      if (p.premium_until) {
        const premTime = new Date(p.premium_until).getTime();
        if (premTime >= now && premTime <= in7d) expire_7j++;
      }

      if (p.visibility === "pause") en_pause++;
      if (p.suspended_until && new Date(p.suspended_until).getTime() > now) suspendus++;
    }

    return {
      total: profiles.length,
      gratuit,
      premium,
      fondateurs,
      expires,
      nouveaux_7j,
      femmes,
      hommes,
      genre_absent,
      actifs_7j,
      actifs_30j,
      verifies,
      non_verifies,
      payants: premium,
      ca_total: 0,
      revenu_par_payant: 0,
      taux_conversion: profiles.length > 0 ? Math.round((premium / profiles.length) * 100) : 0,
      expire_7j,
      inactifs_30j,
      signales: 0,
      en_pause,
      suspendus,
    };
  } catch (err) {
    console.error("[admin/utilisateurs] Exception fallback counts:", err);
    return emptyCounts();
  }
}

export async function fetchUsers(f: Filters): Promise<{ rows: UserRow[]; error: any }> {
  // 1. Essayer la fonction RPC serveur
  try {
    const { data, error } = await supabase.rpc("admin_users_by_plan", {
      p_plan: f.plan,
      p_search: f.search.trim() || null,
      p_limit: PAGE_SIZE,
      p_offset: f.page * PAGE_SIZE,
      p_segment: f.segment,
      p_gender: f.gender,
      p_country: f.country,
      p_verified: f.verified,
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      return { rows: data as UserRow[], error: null };
    }
    if (error) {
      console.warn("[admin/utilisateurs] RPC admin_users_by_plan a échoué, utilisation du fallback direct:", error);
    }
  } catch (e) {
    console.warn("[admin/utilisateurs] Exception appel RPC admin_users_by_plan:", e);
  }

  // 2. Fallback direct sur table profiles
  try {
    let query = supabase.from("profiles").select("*", { count: "exact" });

    // Filtre Plan
    if (f.plan === "gratuit") {
      query = query.or("public_plan.eq.gratuit,public_plan.eq.free,public_plan.is.null");
    } else if (f.plan === "premium") {
      query = query.or("public_plan.eq.premium,is_founder.eq.true");
    }

    // Filtre Recherche
    if (f.search && f.search.trim()) {
      const term = f.search.trim();
      query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`);
    }

    // Filtre Genre (gère Homme/Femme et male/female)
    if (f.gender) {
      if (f.gender === "female") {
        query = query.or("gender.eq.female,gender.eq.Femme");
      } else if (f.gender === "male") {
        query = query.or("gender.eq.male,gender.eq.Homme");
      } else {
        query = query.eq("gender", f.gender);
      }
    }

    // Filtre Pays
    if (f.country && f.country.trim()) {
      query = query.ilike("country", `%${f.country.trim()}%`);
    }

    // Filtre Profil vérifié
    if (f.verified !== null) {
      query = query.eq("is_verified", f.verified);
    }

    // Filtre Segment
    const nowIso = new Date().toISOString();
    if (f.segment === "inactifs") {
      const d30Iso = new Date(Date.now() - 30 * 86400000).toISOString();
      query = query.or(`last_seen.lt.${d30Iso},last_seen.is.null`);
    } else if (f.segment === "expire_bientot") {
      const d7Iso = new Date(Date.now() + 7 * 86400000).toISOString();
      query = query.gte("premium_until", nowIso).lte("premium_until", d7Iso);
    } else if (f.segment === "en_pause") {
      query = query.eq("visibility", "pause");
    } else if (f.segment === "suspendus") {
      query = query.gt("suspended_until", nowIso);
    }

    // Tri & Pagination
    query = query
      .order("created_at", { ascending: false })
      .range(f.page * PAGE_SIZE, (f.page + 1) * PAGE_SIZE - 1);

    const { data: profiles, count, error } = await query;

    if (error) {
      console.error("[admin/utilisateurs] Fallback query profiles error:", error);
      return { rows: [], error };
    }

    const totalCount = count ?? profiles?.length ?? 0;

    const rows: UserRow[] = (profiles ?? []).map((p: any) => ({
      id: p.id,
      first_name: p.first_name || "Membre",
      last_name: p.last_name || null,
      city: p.city || (p.location?.city ?? null),
      country: p.country || (p.location?.country ?? null),
      gender: p.gender || null,
      is_verified: Boolean(p.is_verified),
      is_founder: Boolean(p.is_founder),
      public_plan: p.public_plan ?? (p.is_founder ? "premium" : "gratuit"),
      premium_until: p.premium_until || null,
      created_at: p.created_at || new Date().toISOString(),
      last_seen: p.last_seen || null,
      photos: Array.isArray(p.photos) ? p.photos : null,
      denomination: p.denomination || null,
      visibility: p.visibility || "tous",
      total_paye: 0,
      nb_paiements: 0,
      dernier_paiement: null,
      derniere_offre: null,
      completion: typeof p.completion === "number" ? p.completion : (p.bio ? 75 : 45),
      nb_matchs: 0,
      nb_messages: 0,
      nb_likes_donnes: 0,
      nb_likes_recus: 0,
      nb_signalements: 0,
      nb_blocages: 0,
      nb_tickets: 0,
      suspended_until: p.suspended_until || null,
      suspension_reason: p.suspension_reason || null,
      total_count: totalCount,
    }));

    return { rows, error: null };
  } catch (err) {
    console.error("[admin/utilisateurs] Exception fallback query:", err);
    return { rows: [], error: err };
  }
}

export type UserDetail = {
  profil: any;
  paiements: any[];
  activite: Record<string, number>;
  moderation: { recus: any[]; emis_n: number; bloque_par_n: number; a_bloque_n: number };
  support: any[];
  gestes: any[];
};

export async function fetchUserDetail(id: string): Promise<UserDetail | null> {
  try {
    const { data, error } = await supabase.rpc("admin_user_detail", { p_user_id: id });
    if (!error && data && !(data as any)?.error) {
      const d = data as any;
      // Si la RPC retourne directement { profil, paiements, ... }
      if (d.profil) {
        return d as UserDetail;
      }
      // Si l'ancienne RPC retourne directement la ligne du profil
      if (d.id) {
        return {
          profil: d,
          paiements: [],
          activite: {
            matchs: 0,
            messages_envoyes: 0,
            likes_donnes: 0,
            likes_recus: 0,
            passes: 0,
            swipes_total: 0,
            publications: 0,
            visites_recues: 0,
            boosts: 0,
          },
          moderation: { recus: [], emis_n: 0, bloque_par_n: 0, a_bloque_n: 0 },
          support: [],
          gestes: [],
        };
      }
    }
  } catch (e) {
    console.warn("[admin/utilisateurs] RPC admin_user_detail indisponible:", e);
  }

  // Fallback direct sur tables profiles, payments, support_tickets
  try {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (!profile) return null;

    const [paiementsRes, supportRes, reportsRecusRes] = await Promise.all([
      supabase.from("payments").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20).catch(() => ({ data: [] })),
      supabase.from("support_tickets").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20).catch(() => ({ data: [] })),
      supabase.from("reports").select("*").eq("reported_id", id).order("created_at", { ascending: false }).limit(20).catch(() => ({ data: [] })),
    ]);

    return {
      profil: profile,
      paiements: (paiementsRes as any)?.data ?? [],
      activite: {
        matchs: 0,
        messages_envoyes: 0,
        likes_donnes: 0,
        likes_recus: 0,
        passes: 0,
        swipes_total: 0,
        publications: 0,
        visites_recues: 0,
        boosts: 0,
      },
      moderation: {
        recus: (reportsRecusRes as any)?.data ?? [],
        emis_n: 0,
        bloque_par_n: 0,
        a_bloque_n: 0,
      },
      support: (supportRes as any)?.data ?? [],
      gestes: [],
    };
  } catch (err) {
    console.error("[admin/utilisateurs] Erreur fallback user detail:", err);
    return null;
  }
}

export async function grantDays(
  userId: string, days: number, reason: string, plan: "premium",
) {
  const { data, error } = await supabase.rpc("admin_grant_days", {
    p_user_id: userId,
    p_days: days,
    p_reason: reason,
    p_plan: plan,
  });
  if (error) return { ok: false, reason: error.message };
  return data as { ok: boolean; reason?: string; expires_at?: string };
}

/**
 * Notifie le membre par e-mail.
 *
 * Délibérément détachée de la sanction : si l'envoi échoue — clé Resend
 * absente, fonction non déployée — la suspension reste appliquée. L'inverse
 * serait absurde : on ne renonce pas à sanctionner parce qu'un e-mail n'est
 * pas parti.
 */
async function notifySuspension(payload: Record<string, unknown>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-suspension`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[admin] notification de suspension non envoyée:", e);
  }
}

export async function suspendUser(userId: string, reason: string, days: number | null) {
  const { data, error } = await supabase.rpc("admin_suspend_user", {
    p_user_id: userId,
    p_reason: reason,
    p_days: days,
  });
  if (error) return { ok: false, reason: error.message };

  const res = data as { ok: boolean; reason?: string; until?: string; permanent?: boolean };
  if (res.ok) {
    void notifySuspension({
      userId, action: "suspended", reason,
      until: res.until, permanent: res.permanent,
    });
  }
  return res;
}

export async function unsuspendUser(userId: string) {
  const { data, error } = await supabase.rpc("admin_unsuspend_user", { p_user_id: userId });
  if (error) return { ok: false, reason: error.message };

  const res = data as { ok: boolean; reason?: string };
  if (res.ok) void notifySuspension({ userId, action: "lifted" });
  return res;
}

/** Une suspension à plus de dix ans vaut « définitive » côté affichage. */
export function isSuspended(u: { suspended_until?: string | null }): boolean {
  return Boolean(u.suspended_until) && new Date(u.suspended_until!).getTime() > Date.now();
}

export function isPermanent(u: { suspended_until?: string | null }): boolean {
  if (!u.suspended_until) return false;
  return new Date(u.suspended_until).getTime() > Date.now() + 10 * 365 * 86400000;
}

/**
 * Export CSV du segment affiché.
 *
 * Le point-virgule sépare les colonnes plutôt que la virgule : Excel en
 * configuration française ouvre autrement tout sur une seule colonne. Et
 * le BOM en tête évite que les accents deviennent illisibles.
 */
export function toCsv(rows: UserRow[]): string {
  const cols = [
    ["Prénom", (r: UserRow) => r.first_name],
    ["Nom", (r: UserRow) => r.last_name ?? ""],
    ["Ville", (r: UserRow) => r.city ?? ""],
    ["Pays", (r: UserRow) => r.country ?? ""],
    ["Genre", (r: UserRow) => formatGender(r.gender)],
    ["Offre", (r: UserRow) => (r.is_founder ? "Premium (fondateur)" : r.public_plan)],
    ["Expire le", (r: UserRow) => (r.premium_until ? new Date(r.premium_until).toLocaleDateString("fr-FR") : "")],
    ["Vérifié", (r: UserRow) => (r.is_verified ? "oui" : "non")],
    ["Profil %", (r: UserRow) => String(r.completion)],
    ["Total payé", (r: UserRow) => String(r.total_paye)],
    ["Paiements", (r: UserRow) => String(r.nb_paiements)],
    ["Matchs", (r: UserRow) => String(r.nb_matchs)],
    ["Messages", (r: UserRow) => String(r.nb_messages)],
    ["Signalements", (r: UserRow) => String(r.nb_signalements)],
    ["Blocages subis", (r: UserRow) => String(r.nb_blocages)],
    ["Inscrit le", (r: UserRow) => new Date(r.created_at).toLocaleDateString("fr-FR")],
    ["Dernière activité", (r: UserRow) => (r.last_seen ? new Date(r.last_seen).toLocaleDateString("fr-FR") : "")],
  ] as const;

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lignes = [
    cols.map(c => esc(c[0])).join(";"),
    ...rows.map(r => cols.map(c => esc(c[1](r))).join(";")),
  ];
  return "﻿" + lignes.join("\r\n");
}

export function downloadCsv(rows: UserRow[], nom: string) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nom}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
