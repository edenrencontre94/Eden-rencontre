import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNotification, layout } from "../_shared/email.ts";

/**
 * Envoi d'une campagne marketing.
 *
 * Chaque destinataire passe par `sendNotification`, qui applique les règles
 * de la Phase 0 : liste de suppression, consentement, plafond quotidien,
 * déduplication, et en-tête de désabonnement en un clic.
 *
 * Contourner ces vérifications pour « toucher plus de monde » serait la
 * meilleure façon de faire déclasser le domaine — et de perdre du même
 * coup les e-mails d'inscription, qui partent de la même adresse.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Le corps est saisi librement dans le back-office puis injecté dans du HTML.
// Un prénom ou un texte contenant `<` casserait la mise en page — au mieux.
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();

    if (profile?.role !== "admin") {
      return json({ error: "Réservé aux administrateurs" }, 403);
    }

    const { campaignId } = await req.json();
    if (!campaignId) return json({ error: "campaignId requis" }, 400);

    const { data: campaign, error: campErr } = await supabase
      .from("campaigns").select("*").eq("id", campaignId).single();

    if (campErr || !campaign) return json({ error: "Campagne introuvable" }, 404);

    // Une campagne déjà partie ne doit pas pouvoir être renvoyée : c'est
    // le genre d'erreur qui double le volume et provoque des plaintes.
    if (campaign.status !== "draft") {
      return json({ error: `Cette campagne est déjà au statut « ${campaign.status} »` }, 409);
    }

    await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaignId);

    // Destinataires : uniquement ceux qui ont explicitement consenti.
    const { data: optedIn, error: prefErr } = await supabase
      .from("email_preferences").select("user_id").eq("marketing", true);

    if (prefErr) {
      await supabase.from("campaigns").update({ status: "failed" }).eq("id", campaignId);
      return json({ error: "Lecture des consentements impossible" }, 500);
    }

    const userIds = (optedIn ?? []).map((r: any) => r.user_id);
    if (userIds.length === 0) {
      await supabase.from("campaigns")
        .update({ status: "sent", recipients: 0, delivered: 0, sent_at: new Date().toISOString() })
        .eq("id", campaignId);
      return json({ recipients: 0, delivered: 0, skipped: 0 });
    }

    const { data: profiles } = await supabase
      .from("profiles").select("id, first_name").in("id", userIds);
    const names = new Map((profiles ?? []).map((p: any) => [p.id, p.first_name || "à vous"]));

    let delivered = 0;
    let skipped = 0;

    // Traitement par lots : Resend limite le débit, et un envoi en rafale
    // est aussi un signal négatif pour les fournisseurs de messagerie.
    for (const userId of userIds) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;
      if (!email) { skipped++; continue; }

      // La personnalisation se fait sur le texte, AVANT la mise en page :
      // appliquée ensuite sur le HTML, elle risquerait de toucher le gabarit.
      // Et `replace` avec une chaîne ne remplacerait que la première
      // occurrence — d'où l'expression régulière globale.
      const firstName = names.get(userId) ?? "à vous";
      const personalized = campaign.body.replace(/\{\{prenom\}\}/g, firstName);

      const html = layout({
        title: campaign.subject,
        body: personalized
          .split("\n")
          .filter((l: string) => l.trim())
          .map((l: string) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`)
          .join(""),
        ctaLabel: "Ouvrir AgapeMeet",
        ctaUrl: Deno.env.get("APP_URL") ?? "https://agapemeet.com",
        category: "marketing",
      });

      const res = await sendNotification({
        userId,
        to: email,
        subject: campaign.subject,
        html,
        category: "marketing",
        template: `campaign:${campaignId}`,
        // Une clé par campagne ET par membre : un second déclenchement
        // n'enverra rien en double.
        dedupeKey: `campaign:${campaignId}:${userId}`,
        maxPerDay: 10,
      });

      if (res.ok) delivered++;
      else skipped++;

      await new Promise(r => setTimeout(r, 120));
    }

    await supabase.from("campaigns").update({
      status: "sent",
      recipients: userIds.length,
      delivered,
      skipped,
      sent_at: new Date().toISOString(),
    }).eq("id", campaignId);

    console.log(`[campagne] ${campaignId} : ${delivered} envoyés, ${skipped} ignorés`);
    return json({ recipients: userIds.length, delivered, skipped });
  } catch (err) {
    console.error("[send-campaign]", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
