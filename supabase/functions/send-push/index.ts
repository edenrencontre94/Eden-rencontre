import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

/**
 * Envoi des notifications push.
 *
 * Appelée par les triggers de la migration 58 via pg_net, jamais depuis
 * le navigateur : elle peut notifier n'importe qui, ce qui en ferait un
 * outil de harcèlement si elle était ouverte. D'où l'en-tête secret
 * partagé, vérifié avant toute chose.
 *
 * ⚠️ À DÉPLOYER AVEC --no-verify-jwt
 *    pg_net n'envoie pas de jeton d'authentification Supabase. Sans ce
 *    drapeau, la plateforme rejette l'appel avec un 401 AVANT que notre
 *    code ne s'exécute — et rien n'apparaît dans les journaux.
 *
 *    npx supabase functions deploy send-push --no-verify-jwt
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@agapemeet.com";
const PUSH_SECRET = Deno.env.get("PUSH_SECRET") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Comparaison en temps constant : une comparaison naïve laisse fuir la
  // longueur du préfixe correct par le temps de réponse.
  const fourni = req.headers.get("x-push-secret") ?? "";
  if (!PUSH_SECRET || !egalConstant(fourni, PUSH_SECRET)) {
    console.warn("[send-push] secret invalide");
    return new Response("Forbidden", { status: 403 });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error("[send-push] clés VAPID absentes");
    return new Response("VAPID non configuré", { status: 500 });
  }

  let corps: {
    user_id?: string;
    title?: string;
    body?: string;
    url?: string;
    tag?: string | null;
    /** Total à afficher sur l'icône, calculé en base. */
    badge?: number;
    /** Message en rafale : remplacer sans re-sonner. */
    silencieux?: boolean;
  };
  try {
    corps = await req.json();
  } catch {
    return new Response("JSON invalide", { status: 400 });
  }

  const { user_id, title, body, url, tag, badge, silencieux } = corps;
  if (!user_id || !title) {
    return new Response("user_id et title requis", { status: 400 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: abonnements, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user_id);

  if (error) {
    console.error("[send-push] lecture des abonnements:", error);
    return new Response("Erreur", { status: 500 });
  }
  if (!abonnements?.length) {
    return json({ envoyes: 0, raison: "aucun appareil" });
  }

  const charge = JSON.stringify({
    title,
    body: body ?? "",
    url: url ?? "/accueil",
    tag: tag ?? undefined,
    // Relayé tel quel : c'est la base qui sait combien de messages et de
    // demandes attendent, pas le service worker.
    badge: typeof badge === "number" ? badge : undefined,
    silencieux: silencieux === true ? true : undefined,
  });

  let envoyes = 0;
  const perimes: string[] = [];

  // En parallèle : un membre peut avoir trois appareils, et les services
  // de push mettent parfois plusieurs secondes à répondre.
  await Promise.all(
    abonnements.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          charge,
          // TTL : au-delà de 24 h, une notification de message n'a plus
          // d'intérêt. Le service la jette au lieu de la garder.
          { TTL: 86400, urgency: silencieux ? "normal" : "high" },
        );
        envoyes++;
      } catch (e: any) {
        const code = e?.statusCode;
        // 404 / 410 : abonnement révoqué (application désinstallée,
        // données du navigateur effacées). On le retire, sinon il
        // ferait échouer tous les envois suivants.
        if (code === 404 || code === 410) {
          perimes.push(s.endpoint);
        } else {
          console.error("[send-push] échec:", code, e?.body ?? e?.message);
        }
      }
    }),
  );

  if (perimes.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", perimes);
    console.log(`[send-push] ${perimes.length} appareil(s) périmé(s) retiré(s)`);
  }

  if (envoyes > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ last_used: new Date().toISOString() })
      .eq("user_id", user_id);
  }

  return json({ envoyes, retires: perimes.length });
});

function json(o: unknown) {
  return new Response(JSON.stringify(o), {
    headers: { "Content-Type": "application/json" },
  });
}

function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
