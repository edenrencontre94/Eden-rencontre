import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Rattrapage des paiements restés en attente.
 *
 * Le webhook `successful_sale` reste le chemin normal. Mais il peut échouer
 * définitivement (métadonnées absentes, indisponibilité au mauvais moment) :
 * l'argent est alors encaissé et l'abonnement jamais crédité, en silence.
 *
 * Cette fonction interroge Chariow sur le statut réel des ventes que l'on
 * croit encore en attente, et crédite ce qui doit l'être. Elle transforme
 * une perte silencieuse en récupération automatique.
 */

const CHARIOW_API_KEY = Deno.env.get("CHARIOW_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** On laisse au webhook le temps d'arriver avant de doubler le travail. */
const MIN_AGE_MS = 60_000;

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

const SUCCESS = ["completed", "complete", "successful", "success", "paid"];
const DEAD = ["abandoned", "cancelled", "canceled", "failed", "expired", "refunded"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!CHARIOW_API_KEY) return json({ error: "CHARIOW_API_KEY non configurée" }, 500);

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Authentification requise" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Session invalide" }, 401);

    // ── Paiements en attente de cet utilisateur, assez anciens ──
    const { data: pendings, error: listError } = await supabase
      .from("payments")
      .select("id, sale_id, plan_id, days, hours, offer_id, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .not("sale_id", "is", null)
      .lt("created_at", new Date(Date.now() - MIN_AGE_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    if (listError) {
      console.error("[reconcile] liste:", listError);
      return json({ error: "Lecture impossible" }, 500);
    }

    if (!pendings || pendings.length === 0) {
      return json({ pending: 0, recovered: 0, failed: 0 });
    }

    let recovered = 0;
    let failed = 0;
    let stillPending = 0;

    for (const p of pendings) {
      const res = await fetch(`https://api.chariow.com/v1/sales/${p.sale_id}`, {
        headers: { Authorization: `Bearer ${CHARIOW_API_KEY}` },
      });

      if (!res.ok) {
        console.warn(`[reconcile] vente ${p.sale_id} : HTTP ${res.status}`);
        stillPending++;
        continue;
      }

      const sale = (await res.json())?.data ?? {};
      const status = String(sale?.status ?? "").toLowerCase();
      const payStatus = String(sale?.payment?.status ?? "").toLowerCase();

      const isPaid =
        SUCCESS.includes(status) || SUCCESS.includes(payStatus) || Boolean(sale?.completed_at);
      const isDead = DEAD.includes(status) || DEAD.includes(payStatus);

      if (isPaid) {
        // Passage pending → completed AVANT de créditer, et conditionné à
        // « encore pending » : si le webhook est passé entre-temps, la mise à
        // jour ne renvoie aucune ligne et l'on ne crédite pas deux fois.
        const { data: claimed, error: claimError } = await supabase
          .from("payments")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", p.id)
          .eq("status", "pending")
          .select("id");

        if (claimError) {
          console.error("[reconcile] verrou:", claimError);
          stillPending++;
          continue;
        }
        if (!claimed || claimed.length === 0) {
          // Déjà traité par le webhook — rien à faire
          continue;
        }

        // Un Boost et un abonnement ne se créditent pas de la même façon
        const { error: rpcError } =
          p.plan_id === "boost"
            ? await supabase.rpc("apply_boost_purchase", {
                p_user_id: user.id,
                p_hours: p.hours ?? p.days * 24,
              })
            : await supabase.rpc("apply_subscription_payment", {
                p_user_id: user.id,
                p_plan_id: p.plan_id,
                p_days: p.days,
              });

        if (rpcError) {
          console.error("[reconcile] activation:", rpcError);
          // On rend la ligne au circuit pour retenter au prochain passage
          await supabase.from("payments").update({ status: "pending", completed_at: null }).eq("id", p.id);
          stillPending++;
          continue;
        }

        console.log(`[reconcile] ${p.offer_id} rattrapé pour ${user.id}`);
        recovered++;
      } else if (isDead) {
        await supabase.from("payments").update({ status: "failed" }).eq("id", p.id);
        failed++;
      } else {
        stillPending++;
      }
    }

    return json({ pending: stillPending, recovered, failed });
  } catch (err) {
    console.error("[reconcile]", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
