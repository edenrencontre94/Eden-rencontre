import { supabase } from "@/lib/supabase";

/**
 * Suivi Meta — Pixel navigateur et Conversions API.
 *
 * DEUX CANAUX, UN SEUL ÉVÉNEMENT. Chaque conversion est envoyée par le
 * navigateur ET par le serveur, avec le MÊME `eventID`. Meta reconnaît
 * alors le doublon et ne compte qu'une conversion.
 *
 * Pourquoi les deux : le Pixel seul est bloqué par une part croissante
 * des bloqueurs de publicité et par le traitement iOS — Meta n'apprend
 * qu'une fraction des conversions et optimise à l'aveugle. Le serveur
 * seul perd les signaux du navigateur qui améliorent l'attribution.
 *
 * CE QUI N'EST JAMAIS ENVOYÉ : aucun message, aucune conversation,
 * aucune photo, aucune donnée de vérification d'identité, aucun nom.
 * L'adresse e-mail part hachée, et uniquement depuis le serveur.
 */

const CLE_SESSION = "eden_ad_session";
const CLE_UTM = "eden_utm";

export type Evenement =
  | "PageView" | "ViewContent" | "CompleteRegistration" | "CompleteProfile"
  | "Like" | "Match" | "InitiateCheckout" | "Purchase";

type Utm = {
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_content?: string; utm_term?: string; fbclid?: string;
};

/* ─────────────── Provenance ─────────────── */

/**
 * Lit les paramètres de campagne dans l'URL et les conserve.
 *
 * `localStorage` et non un cookie : le trajet entre le clic sur la
 * publicité et l'inscription prend souvent plusieurs jours, et l'on veut
 * pouvoir rattacher l'un à l'autre.
 *
 * La PREMIÈRE campagne est conservée. Quelqu'un qui revient par une
 * seconde publicité reste attribué à celle qui l'a fait venir : c'est
 * elle qui a produit l'acquisition.
 */
export function capturerProvenance(): void {
  if (typeof window === "undefined") return;

  try {
    const p = new URLSearchParams(window.location.search);
    const lu: Utm = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
      const v = p.get(k);
      if (v) lu[k] = v.slice(0, 200);
    }
    const fbclid = p.get("fbclid");
    if (fbclid) lu.fbclid = fbclid.slice(0, 400);

    if (Object.keys(lu).length === 0) return;
    if (localStorage.getItem(CLE_UTM)) return; // première visite seulement

    localStorage.setItem(CLE_UTM, JSON.stringify(lu));

    // Jeton de session aléatoire : il sert uniquement à ne pas compter
    // dix fois la même visite. Aucune adresse IP, aucun identifiant
    // durable, rien qui permette de reconnaître quelqu'un.
    let session = sessionStorage.getItem(CLE_SESSION);
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem(CLE_SESSION, session);
    }

    supabase.rpc("enregistrer_visite_pub", {
      p_session: session,
      p_utm_source: lu.utm_source ?? null,
      p_utm_medium: lu.utm_medium ?? null,
      p_utm_campaign: lu.utm_campaign ?? null,
      p_utm_content: lu.utm_content ?? null,
      p_utm_term: lu.utm_term ?? null,
      p_fbclid: lu.fbclid ?? null,
      p_path: window.location.pathname.slice(0, 300),
    }).then(({ error }: any) => {
      if (error) console.debug("[meta] visite non enregistrée", error.message);
    });
  } catch {
    // Un navigateur en navigation privée peut refuser le stockage.
    // Le suivi est un confort : il ne doit jamais empêcher la visite.
  }
}

export function provenance(): Utm {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(CLE_UTM) ?? "{}"); } catch { return {}; }
}

/** Rattache la campagne au profil, à la création du compte. */
export async function rattacherProvenance(): Promise<void> {
  const u = provenance();
  if (!u.utm_source && !u.fbclid) return;

  const { error } = await supabase.rpc("rattacher_provenance", {
    p_utm_source: u.utm_source ?? null,
    p_utm_medium: u.utm_medium ?? null,
    p_utm_campaign: u.utm_campaign ?? null,
    p_utm_content: u.utm_content ?? null,
    p_utm_term: u.utm_term ?? null,
    p_fbclid: u.fbclid ?? null,
  });
  if (error) console.debug("[meta] rattachement", error.message);
}

/* ─────────────── Pixel navigateur ─────────────── */

let pixelCharge = false;

/**
 * Charge le Pixel, une seule fois, et uniquement si un identifiant est
 * configuré. Sans identifiant, on ne charge rien : inutile d'imposer un
 * script tiers à chaque visiteur pour rien.
 */
export async function chargerPixel(): Promise<void> {
  if (typeof window === "undefined" || pixelCharge) return;

  const { data } = await supabase
    .from("app_settings").select("value").eq("key", "meta_pixel_id").maybeSingle();

  const id = String((data as any)?.value ?? "").trim();
  if (!id) return;

  pixelCharge = true;

  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string, n?: any, t?: any, s?: any) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    t = b.createElement(e) as HTMLScriptElement; t.async = true; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode!.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  (window as any).fbq("init", id);
  (window as any).fbq("track", "PageView");
}

/* ─────────────── Envoi d'un événement ─────────────── */

/**
 * Envoie un événement par les deux canaux, avec un identifiant commun.
 *
 * ⚠️ `Purchase` n'est PAS déclenché ici. Il part uniquement du webhook de
 * paiement, une fois l'encaissement réellement confirmé. Le déclencher
 * depuis le navigateur reviendrait à compter une vente à chaque clic sur
 * « Payer », y compris quand le paiement échoue.
 */
/**
 * Lit le cookie `_fbp`, posé par le Pixel à la première visite.
 *
 * C'est l'identifiant de navigateur de Meta. Le transmettre avec
 * l'événement serveur permet de rattacher une conversion à la personne
 * qui a vu la publicité — sans lui, la correspondance repose uniquement
 * sur l'adresse e-mail, que beaucoup de comptes n'ont pas encore
 * confirmée au moment de l'événement.
 */
function lireFbp(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)_fbp=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function suivreMeta(
  nom: Exclude<Evenement, "Purchase">,
  options: { valeurXof?: number; userId?: string; telephone?: string } = {},
): Promise<void> {
  if (typeof window === "undefined") return;

  // Identifiant partagé : c'est lui qui permet à Meta de reconnaître que
  // l'envoi navigateur et l'envoi serveur décrivent le même fait.
  const eventId = `${nom.toLowerCase()}_${crypto.randomUUID().slice(0, 12)}`;

  try {
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") {
      fbq("track", nom, options.valeurXof
        ? { value: options.valeurXof, currency: "XOF" }
        : {}, { eventID: eventId });
    }
  } catch { /* le Pixel peut être bloqué : ce n'est pas une erreur */ }

  // L'envoi serveur passe par une fonction Edge : le jeton d'accès ne
  // doit jamais approcher le navigateur.
  try {
    await supabase.functions.invoke("meta-capi", {
      body: {
        event_name: nom,
        event_id: eventId,
        value_xof: options.valeurXof ?? null,
        fbclid: provenance().fbclid ?? null,
        fbp: lireFbp(),
        // Uniquement au paiement, où le numéro est de toute façon saisi
        // pour le Mobile Money. Il est haché côté serveur avant l'envoi.
        phone: options.telephone ?? null,
        source_url: window.location.href.slice(0, 400),
      },
    });
  } catch (e) {
    console.debug("[meta] envoi serveur ignoré", e);
  }
}
