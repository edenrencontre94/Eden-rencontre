import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/auth";

/**
 * Abonnement aux notifications push.
 *
 * Web Push (norme W3C) plutôt que Firebase : fonctionne sur Chrome
 * Android — dominant sur ce marché — sans magasin d'applications et sans
 * dépendance à Google.
 *
 * Limite connue et non contournable : sur iPhone, les notifications
 * n'arrivent QUE si l'application a été ajoutée à l'écran d'accueil
 * (Safari 16.4+). Apple ne l'autorise pas dans un onglet ordinaire.
 * L'interface le dit plutôt que de laisser croire à une panne.
 */

const CLE_PUBLIQUE = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

export type EtatPush =
  | "non_supporte"    // navigateur trop ancien, ou iOS hors écran d'accueil
  | "ios_a_installer" // iPhone : possible, mais il faut ajouter à l'accueil
  | "refuse"          // l'utilisateur a dit non, et seuls les réglages du navigateur peuvent revenir dessus
  | "inactif"         // possible, pas encore demandé
  | "actif"
  | "non_configure";  // clé VAPID absente côté build

/** iOS impose l'installation en écran d'accueil pour recevoir des push. */
function estIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function estInstalle(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export function pushSupporte(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function etatPush(): Promise<EtatPush> {
  if (!pushSupporte()) {
    return estIOS() && !estInstalle() ? "ios_a_installer" : "non_supporte";
  }
  if (!CLE_PUBLIQUE) return "non_configure";
  if (Notification.permission === "denied") return "refuse";
  if (Notification.permission === "default") return "inactif";

  // Permission accordée ne veut pas dire abonné : les données du
  // navigateur ont pu être effacées, ou l'abonnement révoqué.
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "actif" : "inactif";
  } catch {
    return "inactif";
  }
}

/** Enregistre le service worker. Sans effet s'il l'est déjà. */
export async function enregistrerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupporte()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.error("[push] service worker:", e);
    return null;
  }
}

/**
 * Demande l'autorisation et enregistre l'appareil.
 *
 * À n'appeler que sur un geste explicite de l'utilisateur : demander la
 * permission au chargement fait refuser la majorité des gens — et un
 * refus est quasi définitif, seuls les réglages du navigateur permettent
 * d'y revenir.
 */
export async function activerPush(): Promise<{ ok: boolean; raison?: EtatPush }> {
  if (!pushSupporte()) {
    return { ok: false, raison: estIOS() && !estInstalle() ? "ios_a_installer" : "non_supporte" };
  }
  if (!CLE_PUBLIQUE) return { ok: false, raison: "non_configure" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, raison: "refuse" };

  const reg = (await enregistrerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  if (!reg) return { ok: false, raison: "non_supporte" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      // Obligatoire depuis Chrome 52 : impossible d'envoyer un push
      // silencieux, chacun doit afficher une notification.
      userVisibleOnly: true,
      applicationServerKey: base64UrlVersUint8(CLE_PUBLIQUE),
    });
  }

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false };

  const brut = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!brut.endpoint || !brut.keys?.p256dh || !brut.keys?.auth) {
    return { ok: false };
  }

  // `onConflict: endpoint` : réinstaller l'application produit le même
  // endpoint. Sans cela, l'insertion échouerait sur la contrainte
  // d'unicité et l'appareil ne serait jamais réactivé.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: brut.endpoint,
      p256dh: brut.keys.p256dh,
      auth: brut.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[push] enregistrement:", error);
    return { ok: false };
  }
  return { ok: true };
}

export async function desactiverPush(): Promise<boolean> {
  if (!pushSupporte()) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;

    // La ligne est retirée AVANT de désabonner le navigateur : dans
    // l'ordre inverse, un échec réseau laisserait un enregistrement
    // orphelin qui continuerait de recevoir des envois.
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
    return true;
  } catch (e) {
    console.error("[push] désactivation:", e);
    return false;
  }
}

/**
 * La clé VAPID voyage en base64url ; `subscribe` attend des octets.
 */
function base64UrlVersUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(b64);
  // Tampon explicite : `new Uint8Array(n)` est typé sur `ArrayBufferLike`,
  // qui inclut `SharedArrayBuffer` — que `applicationServerKey` refuse.
  const sortie = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) sortie[i] = brut.charCodeAt(i);
  return sortie;
}
