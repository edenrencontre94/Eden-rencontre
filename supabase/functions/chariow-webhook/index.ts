import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactional, subscriptionConfirmedEmail } from "../_shared/email.ts";

/**
 * Un ou plusieurs secrets, séparés par des virgules.
 *
 * Chaque Pulse possède son propre `whsec_`. En accepter plusieurs permet
 * d'avoir deux Pulses en parallèle (le temps d'une migration), ou de faire
 * tourner un secret sans fenêtre d'interruption : on ajoute le nouveau,
 * on bascule, puis on retire l'ancien.
 */
const PULSE_SECRETS = (Deno.env.get("CHARIOW_PULSE_SECRET") ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Durées de référence, côté serveur uniquement.
 * Ne JAMAIS lire la durée depuis le webhook : elle transite par les
 * métadonnées, qu'un attaquant pourrait tenter de manipuler.
 */
type OfferDef =
  | { kind: "subscription"; planId: "premium" | "vip"; days: number; level: number }
  | { kind: "boost"; hours: number };

/** Montants de reference, pour le recu. Jamais lus depuis le webhook. */
const PRICES: Record<string, number> = {
  premium_15j: 2500, premium_1m: 4000, premium_3m: 10500, vip_1m: 12000,
  boost_24h: 1000, boost_3j: 2000, boost_7j: 3500,
};

const OFFER_DAYS: Record<string, OfferDef> = {
  premium_15j: { kind: "subscription", planId: "premium", days: 15, level: 1 },
  premium_1m: { kind: "subscription", planId: "premium", days: 30, level: 2 },
  premium_3m: { kind: "subscription", planId: "premium", days: 90, level: 3 },
  vip_1m: { kind: "subscription", planId: "vip", days: 30, level: 4 },
  boost_24h: { kind: "boost", hours: 24 },
  boost_3j: { kind: "boost", hours: 72 },
  boost_7j: { kind: "boost", hours: 168 },
};

/** Comparaison à temps constant, pour ne pas fuiter la signature octet par octet. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    if (PULSE_SECRETS.length === 0) {
      console.error("CHARIOW_PULSE_SECRET absent");
      return new Response("Not configured", { status: 500 });
    }

    // ── 1. Vérifier la signature sur le CORPS BRUT ──
    //    Impératif : ne pas passer par req.json() avant, la moindre
    //    renormalisation du JSON invaliderait le HMAC.
    const raw = await req.text();
    const received = req.headers.get("x-chariow-signature") ?? "";
    const encoder = new TextEncoder();

    let signatureOk = false;
    for (const secret of PULSE_SECRETS) {
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(raw)));
      if (timingSafeEqual(`sha256=${toHex(mac)}`, received)) {
        signatureOk = true;
        break;
      }
    }

    if (!signatureOk) {
      console.warn(`Signature invalide (${PULSE_SECRETS.length} secret(s) testé(s))`);
      return new Response("Invalid signature", { status: 401 });
    }

    // ── 2. Déduplication ──
    //    La signature Chariow n'embarque pas d'horodatage : une requête
    //    rejouée reste valide pour toujours. Le delivery-id est donc la
    //    SEULE protection contre le rejeu — sans lui, on créditerait
    //    plusieurs fois le même paiement.
    const deliveryId = req.headers.get("x-pulse-delivery-id");
    if (!deliveryId) return new Response("Missing delivery id", { status: 400 });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const payload = JSON.parse(raw);
    const event: string = payload?.event ?? payload?.type ?? "unknown";

    const { error: dedupeError } = await supabase
      .from("webhook_deliveries")
      .insert({ delivery_id: deliveryId, event });

    if (dedupeError) {
      // Violation de clé primaire = livraison déjà traitée. On répond 200
      // pour que Chariow cesse de réessayer.
      if (dedupeError.code === "23505") return new Response("Already processed", { status: 200 });
      console.error("dedupe:", dedupeError);
      return new Response("Storage error", { status: 500 });
    }

    // ── 3. Ne traiter que les ventes abouties ──
    // Le déclencheur configuré côté Chariow est « successful_sale ».
    // Le second test reste tolérant si le nom évolue.
    const isSuccessfulSale =
      event === "successful_sale" || event.includes("successful") || event.includes("completed");

    if (!isSuccessfulSale) {
      console.log(`Événement ignoré : ${event}`);
      return new Response("Ignored", { status: 200 });
    }

    const sale = payload?.data?.sale ?? payload?.data ?? payload?.sale ?? {};
    const meta =
      sale?.custom_metadata ??
      payload?.data?.custom_metadata ??
      payload?.custom_metadata ??
      sale?.metadata ??
      {};

    // Trace la forme réelle du payload : indispensable pour diagnostiquer
    // le premier paiement réel sans avoir à deviner la structure.
    console.log("Pulse reçu", {
      event,
      deliveryId,
      payloadKeys: Object.keys(payload ?? {}),
      dataKeys: Object.keys(payload?.data ?? {}),
      saleKeys: Object.keys(sale ?? {}),
      metaKeys: Object.keys(meta ?? {}),
    });

    const userId: string | undefined = meta?.user_id;
    const offerId: string | undefined = meta?.offer_id;
    const paymentId: string | undefined = meta?.payment_id;

    if (!userId || !offerId) {
      console.error("Métadonnées absentes", { deliveryId, meta });
      return new Response("Missing metadata", { status: 200 });
    }

    const offer = OFFER_DAYS[offerId];
    if (!offer) {
      console.error("Offre inconnue:", offerId);
      return new Response("Unknown offer", { status: 200 });
    }

    // ── 4. Verrouiller le paiement AVANT de créditer ──
    //    La déduplication sur delivery_id ne protège que d'un rejeu du MÊME
    //    envoi. Si deux Pulses couvrent le même produit, Chariow émet deux
    //    notifications distinctes pour une seule vente — deux delivery_id,
    //    donc deux crédits. Le vrai garde-fou est ici : on ne crédite que si
    //    l'on parvient à faire passer le paiement de `pending` à `completed`.
    const claimQuery = supabase
      .from("payments")
      .update({ status: "completed", completed_at: new Date().toISOString(), sale_id: sale?.id ?? null })
      .eq("status", "pending");

    const { data: claimed, error: claimError } = paymentId
      ? await claimQuery.eq("id", paymentId).select("id")
      : await claimQuery.eq("sale_id", sale?.id ?? "").select("id");

    if (claimError) {
      console.error("verrou paiement:", claimError);
      return new Response("Storage error", { status: 500 });
    }

    if (!claimed || claimed.length === 0) {
      // Déjà crédité — par l'autre Pulse, par un rejeu, ou par la réconciliation
      console.log(`Paiement déjà traité, aucun crédit supplémentaire (${paymentId ?? sale?.id})`);
      return new Response("Already credited", { status: 200 });
    }

    // ── 5. Créditer (les deux fonctions PROLONGENT la période en cours) ──
    const { data: newExpiry, error: rpcError } =
      offer.kind === "boost"
        ? await supabase.rpc("apply_boost_purchase", {
            p_user_id: userId,
            p_hours: offer.hours,
          })
        : await supabase.rpc("apply_subscription_payment", {
            p_user_id: userId,
            p_plan_id: offer.planId,
            p_days: offer.days,
            p_level: offer.level,
          });

    if (rpcError) {
      console.error("activation:", rpcError);
      // Le paiement retourne en attente pour que le rattrapage le reprenne,
      // plutôt que de rester marqué réglé sans avoir rien crédité.
      await supabase
        .from("payments")
        .update({ status: "pending", completed_at: null })
        .eq("id", claimed[0].id);
      return new Response("Activation failed", { status: 500 });
    }

    const label = offer.kind === "boost" ? `Boost ${offer.hours} h` : `Abonnement ${offer.planId}`;
    console.log(`${label} activé pour ${userId} jusqu'au ${newExpiry}`);

    // ── 5 bis. Purchase vers Meta ──
    //
    // ICI, et nulle part ailleurs. C'est le seul endroit du projet où un
    // encaissement est réellement confirmé : le verrou `pending →
    // completed` vient de réussir, donc l'argent est arrivé.
    //
    // Déclencher depuis le navigateur, au clic sur « Payer », compterait
    // une vente pour chaque tunnel abandonné — et Meta optimiserait les
    // campagnes sur des conversions qui n'ont jamais eu lieu.
    //
    // L'identifiant dérive du paiement : un rejeu du webhook produit le
    // même `event_id`, que la contrainte unique en base écarte. Aucune
    // double conversion possible.
    //
    // Sans `await` ni `throw` : l'accès du membre est déjà ouvert, et un
    // envoi publicitaire raté ne doit jamais faire échouer le webhook —
    // Chariow le rejouerait, au risque d'un double crédit.
    try {
      const secret = Deno.env.get("PUSH_SECRET") ?? "";
      if (secret) {
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-capi`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-push-secret": secret },
          body: JSON.stringify({
            event_name: "Purchase",
            event_id: `purchase_${claimed[0].id}`,
            user_id: userId,
            value_xof: PRICES[offerId] ?? undefined,
          }),
        }).catch(e => console.error("[meta] Purchase:", e));
      }
    } catch (e) {
      console.error("[meta] Purchase ignoré:", e);
    }

    // ── 6. Confirmation par e-mail ──
    // Volontairement APRÈS l'activation et sans `throw` : l'accès est déjà
    // ouvert, un e-mail qui ne part pas ne doit jamais faire échouer le
    // webhook — Chariow le rejouerait et on risquerait un double crédit.
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", userId)
        .single();

      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;

      if (email) {
        const isBoost = offer.kind === "boost";
        const mail = subscriptionConfirmedEmail({
          firstName: profile?.first_name || "à vous",
          planLabel: isBoost ? "Boost" : offer.planId === "vip" ? "VIP" : "Premium",
          durationLabel: isBoost
            ? `${offer.hours} heures de mise en avant`
            : `${offer.days} jours`,
          amountXOF: PRICES[offerId] ?? 0,
          expiresAt: typeof newExpiry === "string" ? newExpiry : null,
        });

        await sendTransactional({
          userId,
          to: email,
          subject: mail.subject,
          html: mail.html,
          template: "subscription_confirmed",
          // Un rejeu de la notification ne renverra pas le reçu deux fois
          dedupeKey: `payment:${paymentId ?? sale?.id ?? deliveryId}`,
        });
      }
    } catch (mailError) {
      console.error("[webhook] e-mail de confirmation:", mailError);
    }
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("chariow-webhook:", err);
    return new Response("Error", { status: 500 });
  }
});
