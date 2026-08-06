import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactional, layout } from "../_shared/email.ts";

/**
 * Prévient un membre que son compte vient d'être suspendu — ou rétabli.
 *
 * L'écran de suspension explique déjà tout à qui ouvre l'application. Cet
 * e-mail s'adresse à celui qui ne l'ouvre pas : sans lui, il découvre la
 * sanction des jours plus tard, au pire moment, et l'attribue à une panne.
 *
 * Catégorie `transactional` : une sanction ne se désabonne pas.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://agapemeet.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Authentification requise" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Session invalide" }, 401);

    // Le rôle est vérifié EN BASE, pas d'après ce que dit la requête.
    const { data: admin } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();

    if (admin?.role !== "admin") {
      return json({ error: "Réservé aux administrateurs" }, 403);
    }

    const { userId, action, reason, until, permanent } = await req.json();
    if (!userId || !["suspended", "lifted"].includes(action)) {
      return json({ error: "Paramètres invalides" }, 400);
    }

    const { data: profile } = await supabase
      .from("profiles").select("first_name").eq("id", userId).single();

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (!email) return json({ skipped: "no_email" });

    const prenom = profile?.first_name || "";
    const bonjour = prenom ? `Bonjour ${escapeHtml(prenom)},` : "Bonjour,";

    const finLisible = until && !permanent
      ? new Date(until).toLocaleDateString("fr-FR", {
          day: "numeric", month: "long", year: "numeric",
        })
      : null;

    const subject = action === "suspended"
      ? "Votre compte AgapeMeet a été suspendu"
      : "Votre compte AgapeMeet est de nouveau accessible";

    const body = action === "suspended"
      ? `<p style="margin:0 0 12px">${bonjour}</p>
         <p style="margin:0 0 12px">
           L'accès à votre compte AgapeMeet a été suspendu par notre équipe
           ${finLisible ? `jusqu'au <strong>${finLisible}</strong>` : "pour une durée indéterminée"}.
         </p>
         ${reason ? `<p style="margin:0 0 12px;padding:12px;background:#faf7f8;border-radius:12px">
           <strong>Motif :</strong> ${escapeHtml(String(reason))}
         </p>` : ""}
         <p style="margin:0 0 12px">
           Vos conversations, votre profil et votre abonnement sont conservés.
           ${finLisible ? "Ils vous seront rendus à la levée de la suspension." : ""}
         </p>
         <p style="margin:0 0 12px">
           Si vous pensez qu'il s'agit d'une erreur, répondez à cet e-mail :
           nous réexaminerons la situation.
         </p>`
      : `<p style="margin:0 0 12px">${bonjour}</p>
         <p style="margin:0 0 12px">
           Votre compte AgapeMeet est de nouveau accessible. Vos conversations
           et votre profil vous attendent, intacts.
         </p>
         <p style="margin:0 0 12px">Merci de votre compréhension.</p>`;

    const res = await sendTransactional({
      userId,
      to: email,
      subject,
      html: layout({
        title: action === "suspended" ? "Compte suspendu" : "Compte rétabli",
        body,
        ctaLabel: action === "lifted" ? "Retrouver AgapeMeet" : undefined,
        ctaUrl: action === "lifted" ? `${APP_URL}/accueil` : undefined,
        category: "transactional",
      }),
      template: `suspension:${action}`,
      // Une clé par membre et par horodatage : lever puis re-suspendre le
      // même compte doit pouvoir renotifier, mais un double clic ne doit
      // pas envoyer deux fois.
      dedupeKey: `suspension:${action}:${userId}:${until ?? "none"}`,
    });

    return json({ ok: res.ok, skipped: res.skipped ?? null });
  } catch (err) {
    console.error("[notify-suspension]", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
