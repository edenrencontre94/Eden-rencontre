import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Configuration ──────────────────────────────────────────────────────────
const CHARIOW_API_KEY = Deno.env.get("CHARIOW_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://agapemeet.com";

/**
 * Catalogue serveur — volontairement dupliqué depuis src/lib/plans.ts.
 * Le prix et la durée ne doivent JAMAIS venir du client : sinon n'importe qui
 * peut demander 3 mois de VIP en payant 1 FCFA.
 */
type Offer = {
  kind: "subscription" | "boost";
  planId: "premium" | "vip" | "boost";
  days: number;
  hours?: number;
  amountXOF: number;
  env: string;
};

const OFFERS: Record<string, Offer> = {
  // Abonnements
  premium_15j: { kind: "subscription", planId: "premium", days: 15, amountXOF: 2500, env: "CHARIOW_PRODUCT_PREMIUM_15J" },
  premium_1m: { kind: "subscription", planId: "premium", days: 30, amountXOF: 4000, env: "CHARIOW_PRODUCT_PREMIUM_1M" },
  premium_3m: { kind: "subscription", planId: "premium", days: 90, amountXOF: 10500, env: "CHARIOW_PRODUCT_PREMIUM_3M" },
  vip_1m: { kind: "subscription", planId: "vip", days: 30, amountXOF: 12000, env: "CHARIOW_PRODUCT_VIP_1M" },
  // Boosts à l'unité
  boost_24h: { kind: "boost", planId: "boost", days: 1, hours: 24, amountXOF: 1000, env: "CHARIOW_PRODUCT_BOOST_24H" },
  boost_3j: { kind: "boost", planId: "boost", days: 3, hours: 72, amountXOF: 2000, env: "CHARIOW_PRODUCT_BOOST_3J" },
  boost_7j: { kind: "boost", planId: "boost", days: 7, hours: 168, amountXOF: 3500, env: "CHARIOW_PRODUCT_BOOST_7J" },
};

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!CHARIOW_API_KEY) return json({ error: "CHARIOW_API_KEY non configurée" }, 500);

    // ── 1. Authentifier l'appelant via son JWT ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Authentification requise" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Session invalide" }, 401);

    // ── 2. Valider l'offre demandée contre le catalogue serveur ──
    const { offerId, phone, countryCode } = await req.json();
    const offer = OFFERS[offerId];
    if (!offer) return json({ error: "Offre inconnue" }, 400);

    const productId = Deno.env.get(offer.env);
    if (!productId) {
      return json({ error: `Produit Chariow non configuré : ${offer.env}` }, 500);
    }

    if (!phone || !countryCode) {
      return json({ error: "Numéro de téléphone et indicatif requis" }, 400);
    }

    // ── 3. Récupérer l'identité de l'acheteur ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    // ── 4. Enregistrer le paiement en attente AVANT d'appeler Chariow ──
    //    Si l'utilisateur ferme l'onglet, la réconciliation le retrouvera.
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        offer_id: offerId,
        plan_id: offer.planId,
        days: offer.days,
        hours: offer.hours ?? null,
        amount_xof: offer.amountXOF,
        status: "pending",
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("payments insert:", paymentError);
      return json({ error: "Impossible d'enregistrer le paiement" }, 500);
    }

    // ── 5. Initier le checkout Chariow ──
    const chariowRes = await fetch("https://api.chariow.com/v1/checkout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CHARIOW_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        email: user.email,
        first_name: profile?.first_name || "Membre",
        last_name: profile?.last_name || "AgapeMeet",
        phone: {
          number: String(phone).replace(/\D/g, ""),
          country_code: countryCode,
        },
        // Ce qui permettra au webhook de savoir QUI a payé et QUOI
        custom_metadata: {
          user_id: user.id,
          payment_id: payment.id,
          offer_id: offerId,
          kind: offer.kind,
          plan_id: offer.planId,
          days: String(offer.days),
          hours: String(offer.hours ?? ""),
        },
        redirect_url: `${APP_URL}/abonnement?paiement=retour`,
      }),
    });

    const result = await chariowRes.json();

    if (!chariowRes.ok) {
      console.error("Chariow checkout:", chariowRes.status, result);
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return json({ error: result?.message ?? "Chariow a refusé la demande" }, 502);
    }

    const data = result?.data ?? {};
    const checkoutUrl = data?.payment?.checkout_url ?? null;

    await supabase
      .from("payments")
      .update({
        sale_id: data?.purchase?.id ?? null,
        transaction_id: data?.payment?.transaction_id ?? null,
        checkout_url: checkoutUrl,
        // Un produit gratuit ou déjà acheté revient « completed » sans paiement
        status: data?.step === "completed" ? "completed" : "pending",
      })
      .eq("id", payment.id);

    // Cas où Chariow finalise immédiatement (montant nul, achat déjà effectué)
    if (data?.step === "completed") {
      if (offer.kind === "boost") {
        await supabase.rpc("apply_boost_purchase", {
          p_user_id: user.id,
          p_hours: offer.hours,
        });
      } else {
        await supabase.rpc("apply_subscription_payment", {
          p_user_id: user.id,
          p_plan_id: offer.planId,
          p_days: offer.days,
        });
      }
      return json({ step: "completed", paymentId: payment.id, kind: offer.kind });
    }

    if (!checkoutUrl) {
      return json({ error: "Chariow n'a pas renvoyé d'URL de paiement" }, 502);
    }

    return json({ step: "payment", checkoutUrl, paymentId: payment.id });
  } catch (err) {
    console.error("chariow-checkout:", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
