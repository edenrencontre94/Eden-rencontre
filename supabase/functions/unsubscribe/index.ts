import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Désabonnement en un clic.
 *
 * À déployer avec --no-verify-jwt : le destinataire clique depuis sa boîte
 * mail, sans session. C'est justement l'exigence de Gmail et Yahoo — un
 * désabonnement qui impose de se connecter d'abord ne compte pas, et son
 * absence fait basculer les envois en indésirables.
 *
 * Le jeton (`profiles.unsubscribe_token`) identifie le destinataire sans
 * exposer son identifiant. Il ne donne aucun autre droit que celui de
 * désactiver une catégorie facultative.
 *
 * GET  → page de confirmation lisible par un humain
 * POST → appelé automatiquement par Gmail via List-Unsubscribe-Post
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://agapemeet.com";

const LABELS: Record<string, string> = {
  matches: "les notifications de match",
  messages: "les résumés de messages",
  visitors: "les notifications de visite",
  community: "les notifications de la communauté",
  marketing: "les actualités et conseils",
  all: "tous les e-mails facultatifs",
};

function page(title: string, message: string, ok: boolean) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — AgapeMeet</title></head>
<body style="margin:0;background:#faf7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <div style="max-width:460px;margin:60px auto;background:#fff;border:1px solid #efe6ea;border-radius:16px;padding:32px;text-align:center">
    <div style="font-size:22px;font-weight:700;color:#7c3f5d">Agape<span style="color:#c9a227">Meet</span></div>
    <div style="font-size:40px;margin:18px 0 8px">${ok ? "✅" : "⚠️"}</div>
    <h1 style="font-size:19px;color:#1f1720;margin:0 0 10px">${title}</h1>
    <p style="font-size:14px;line-height:1.6;color:#544a50;margin:0">${message}</p>
    <a href="${APP_URL}/parametres/notifications"
       style="display:inline-block;margin-top:22px;background:#7c3f5d;color:#fff;text-decoration:none;
              padding:11px 22px;border-radius:999px;font-size:14px;font-weight:600">
      Gérer toutes mes préférences
    </a>
  </div>
</body></html>`;
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const category = url.searchParams.get("category") ?? "all";

  const html = (body: string, status = 200) =>
    new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

  if (!token) {
    return html(page("Lien invalide", "Ce lien de désabonnement est incomplet.", false), 400);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await supabase.rpc("unsubscribe_by_token", {
      p_token: token,
      p_category: category,
    });

    if (error || !data?.ok) {
      console.error("[unsubscribe]", error ?? data);
      return html(
        page(
          "Lien expiré",
          "Ce lien n'est plus valable. Vous pouvez ajuster vos préférences depuis l'application.",
          false,
        ),
        400,
      );
    }

    // Gmail appelle l'URL en POST sans afficher de page : une réponse
    // courte suffit, et doit rester en 200 pour valider l'opération.
    if (req.method === "POST") {
      return new Response("OK", { status: 200 });
    }

    return html(
      page(
        "C'est fait",
        `Vous ne recevrez plus ${LABELS[category] ?? "ces e-mails"}. Les messages liés à vos paiements et à la sécurité de votre compte continueront de vous être adressés.`,
        true,
      ),
    );
  } catch (err) {
    console.error("[unsubscribe]", err);
    return html(page("Erreur", "Une erreur est survenue. Réessayez depuis l'application.", false), 500);
  }
});
