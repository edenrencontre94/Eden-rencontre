/* eslint-disable no-undef */
/**
 * Service worker – notifications push.
 *
 * Volontairement minimal : il ne met RIEN en cache. Un service worker
 * qui sert des pages hors ligne doit être versionné et purgé à chaque
 * déploiement, sans quoi les membres restent bloqués sur une version
 * ancienne sans comprendre pourquoi. Ici, il ne fait qu'une chose.
 */

const ICONE = "/icon-192.png";
const BADGE = "/favicon-96x96.png";

self.addEventListener("install", () => {
  // Prend la main immédiatement : sans cela, la première activation
  // attend la fermeture de tous les onglets – donc les notifications
  // n'arriveraient qu'au prochain lancement de l'application.
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

/**
 * Gestionnaire `fetch` – condition d'installabilité.
 *
 * Chrome Android ne propose « Installer l'application » que si le
 * service worker écoute cet évènement. Sans lui, le manifeste a beau
 * être parfait, l'invitation n'apparaît jamais.
 *
 * Il ne met RIEN en cache, volontairement. Un service worker qui sert
 * des pages hors ligne doit être versionné et purgé à chaque
 * déploiement – sans quoi les membres restent bloqués sur une version
 * ancienne, sans comprendre pourquoi et sans pouvoir en sortir. On
 * remplit la condition, on n'introduit pas le risque.
 *
 * Le `return` sans `respondWith` laisse le navigateur gérer la requête
 * exactement comme si le service worker n'existait pas.
 */
self.addEventListener("fetch", () => {
  return;
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Charge utile illisible : on affiche quand même quelque chose.
    // Une notification muette est pire qu'une notification générique –
    // le navigateur en signale l'absence à l'utilisateur.
    data = { title: "Eden Rencontre", body: "Vous avez du nouveau." };
  }

  // Pastille sur l'icône, mise à jour même application FERMÉE.
  //
  // C'est le point important : sans cela, le chiffre ne bougerait qu'à
  // la prochaine ouverture – c'est-à-dire trop tard pour donner envie
  // d'ouvrir.
  //
  // Le total est calculé côté serveur et transmis dans la charge utile :
  // le service worker n'a ni session ni accès à la base pour le compter
  // lui-même.
  if (typeof data.badge === "number" && self.navigator?.setAppBadge) {
    event.waitUntil(
      data.badge > 0
        ? self.navigator.setAppBadge(data.badge).catch(() => {})
        : self.navigator.clearAppBadge?.().catch(() => {}),
    );
  }

  const titre = data.title || "Eden Rencontre";
  const options = {
    body: data.body || "",
    icon: data.icon || ICONE,
    badge: BADGE,
    lang: "fr",
    // `tag` : une nouvelle notification du même fil REMPLACE la
    // précédente au lieu de s'empiler. Dix messages d'une même personne
    // ne doivent pas produire dix lignes.
    tag: data.tag || "agape",
    // `silencieux` : message en rafale. On remplace le texte et la
    // pastille SANS re-sonner.
    //
    // Le Web Push impose d'afficher quelque chose à chaque envoi – on ne
    // peut pas transmettre une pastille en silence. Ce remplacement est
    // le seul moyen de garder le chiffre juste sans harceler.
    renotify: Boolean(data.tag) && !data.silencieux,
    silent: Boolean(data.silencieux),
    data: { url: data.url || "/accueil" },
    // Vibration courte, et aucune sur un remplacement.
    vibrate: data.silencieux ? [] : [80, 40, 80],
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const cible = event.notification.data?.url || "/accueil";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(fenetres => {
        // Réutiliser un onglet déjà ouvert plutôt que d'en empiler un
        // nouveau à chaque notification.
        for (const f of fenetres) {
          if (f.url.includes(self.location.origin)) {
            f.navigate(cible);
            return f.focus();
          }
        }
        return self.clients.openWindow(cible);
      }),
  );
});
