/* eslint-disable no-undef */
/**
 * Service worker — notifications push.
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
  // attend la fermeture de tous les onglets — donc les notifications
  // n'arriveraient qu'au prochain lancement de l'application.
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Charge utile illisible : on affiche quand même quelque chose.
    // Une notification muette est pire qu'une notification générique —
    // le navigateur en signale l'absence à l'utilisateur.
    data = { title: "AgapeMeet", body: "Vous avez du nouveau." };
  }

  const titre = data.title || "AgapeMeet";
  const options = {
    body: data.body || "",
    icon: data.icon || ICONE,
    badge: BADGE,
    lang: "fr",
    // `tag` : une nouvelle notification du même fil REMPLACE la
    // précédente au lieu de s'empiler. Dix messages d'une même personne
    // ne doivent pas produire dix lignes.
    tag: data.tag || "agape",
    renotify: Boolean(data.tag),
    data: { url: data.url || "/accueil" },
    // Vibration courte : la version longue est perçue comme agressive.
    vibrate: [80, 40, 80],
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
