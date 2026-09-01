import { supabase } from "@/lib/supabase";

/**
 * Lance un paiement Chariow pour n'importe quelle offre (abonnement ou Boost).
 *
 * Le client n'envoie QUE l'identifiant d'offre : le prix, la durée et le
 * produit Chariow sont résolus côté serveur. Sans cette règle, il suffirait
 * de modifier la requête pour s'offrir 3 mois de VIP au tarif d'un Boost.
 */
export async function startCheckout(
  offerId: string,
  phone: string,
  countryCode: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Vous devez être connecté" };

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chariow-checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ offerId, phone, countryCode }),
      },
    );

    const json = await res.json();
    if (!res.ok) return { ok: false, error: json?.error ?? "Le paiement n'a pas pu être lancé" };

    // Chariow affiche ses propres moyens de paiement selon l'indicatif
    const redirectUrl = json.checkoutUrl ?? json.url;
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return { ok: true };
    }
    if (json.step === "completed") return { ok: true };


    return { ok: false, error: "Réponse inattendue du serveur de paiement" };
  } catch (e) {
    console.error("[checkout]", e);
    return { ok: false, error: "Erreur réseau" };
  }
}
