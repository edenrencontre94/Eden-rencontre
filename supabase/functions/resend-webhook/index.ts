import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Réception des événements Resend : rebonds et plaintes.
 *
 * Continuer d'écrire à une adresse en rebond dur, ou à quelqu'un ayant
 * cliqué « courrier indésirable », dégrade la réputation du domaine à
 * CHAQUE tentative. Sans cette fonction, la liste de suppression resterait
 * vide et le taux de plainte grimperait jusqu'à ce que Gmail déclasse le
 * domaine — y compris pour les e-mails d'inscription.
 *
 * À déployer avec --no-verify-jwt : Resend n'a pas de JWT Supabase, c'est
 * la signature Svix qui l'authentifie.
 */

const SIGNING_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vérification de signature Svix (format utilisé par Resend).
 * Le message signé est `id.timestamp.payload`, et le secret est encodé en
 * base64 après le préfixe « whsec_ ».
 */
async function verify(payload: string, headers: Headers): Promise<boolean> {
  if (!SIGNING_SECRET) return false;

  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;

  // Contrairement à Chariow, Svix inclut un horodatage : on rejette les
  // requêtes trop anciennes, ce qui ferme la fenêtre de rejeu.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const secretBytes = Uint8Array.from(
    atob(SIGNING_SECRET.replace(/^whsec_/, "")),
    c => c.charCodeAt(0),
  );

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`)),
  );
  const expected = btoa(String.fromCharCode(...mac));

  // L'en-tête peut contenir plusieurs signatures, séparées par des espaces
  return signatures
    .split(" ")
    .map(s => s.split(",")[1] ?? "")
    .some(sig => timingSafeEqual(sig, expected));
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const raw = await req.text();

    if (!(await verify(raw, req.headers))) {
      console.warn("[resend-webhook] signature invalide");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(raw);
    const type: string = event?.type ?? "";
    const email: string | undefined = event?.data?.to?.[0] ?? event?.data?.email;

    if (!email) {
      console.warn("[resend-webhook] adresse absente", { type });
      return new Response("OK", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Seuls le rebond DUR et la plainte suppriment définitivement.
    // Un rebond temporaire (boîte pleine, serveur indisponible) ne doit pas
    // priver quelqu'un de ses reçus de paiement.
    const isHardBounce =
      type === "email.bounced" &&
      ["hard", "permanent"].includes(String(event?.data?.bounce?.type ?? "").toLowerCase());
    const isComplaint = type === "email.complained";

    if (!isHardBounce && !isComplaint) {
      return new Response("Ignored", { status: 200 });
    }

    const { error } = await supabase.from("email_suppression").upsert(
      { email: email.toLowerCase(), reason: isComplaint ? "complaint" : "bounce" },
      { onConflict: "email" },
    );

    if (error) {
      console.error("[resend-webhook] suppression:", error);
      return new Response("Storage error", { status: 500 });
    }

    // Une plainte vaut refus explicite : on coupe aussi toutes les
    // catégories facultatives, sans attendre un clic de désabonnement.
    if (isComplaint) {
      const { data: profile } = await supabase.auth.admin.listUsers();
      const user = profile?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (user) {
        await supabase
          .from("email_preferences")
          .update({ matches: false, messages: false, visitors: false, community: false, marketing: false })
          .eq("user_id", user.id);
      }
    }

    console.log(`[resend-webhook] ${email} supprimé (${isComplaint ? "plainte" : "rebond"})`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[resend-webhook]", err);
    return new Response("Error", { status: 500 });
  }
});
