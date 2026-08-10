import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Conversions API de Meta — envoi côté serveur.
 *
 * POURQUOI CÔTÉ SERVEUR. Le Pixel navigateur est bloqué par une part
 * croissante des bloqueurs de publicité et par le traitement iOS. Sans
 * envoi serveur, Meta n'apprend qu'une fraction des conversions — et
 * optimise donc les campagnes sur une vision partielle.
 *
 * LE JETON NE SORT JAMAIS D'ICI. `META_ACCESS_TOKEN` est un secret de la
 * fonction : il n'est ni dans le dépôt, ni dans le navigateur, ni dans la
 * base, ni renvoyé dans une réponse.
 *
 * DÉDUPLICATION. Chaque événement porte un `event_id` partagé avec sa
 * version navigateur. Meta reconnaît alors le doublon et ne compte qu'une
 * conversion. Un second garde-fou existe en base : la contrainte unique
 * (event_id, source) empêche de réémettre le même envoi.
 *
 * ⚠️ À DÉPLOYER AVEC --no-verify-jwt
 *    Purchase est déclenché par le webhook de paiement, qui n'a pas de
 *    session Supabase. L'accès est protégé par le secret partagé.
 *
 *    npx supabase functions deploy meta-capi --no-verify-jwt
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TOKEN = Deno.env.get("META_ACCESS_TOKEN") ?? "";
const SECRET = Deno.env.get("PUSH_SECRET") ?? "";
const API = Deno.env.get("META_API_VERSION") ?? "v21.0";

/** Événements admis. Une liste blanche évite qu'un appel forgé n'injecte
 *  n'importe quoi dans le compte publicitaire. */
const EVENEMENTS = new Set([
  "PageView", "ViewContent", "CompleteRegistration", "CompleteProfile",
  "Like", "Match", "InitiateCheckout", "Purchase", "TestEvent",
]);

/**
 * Meta exige que les données personnelles soient hachées en SHA-256,
 * minuscules et sans espaces. On n'envoie QUE l'adresse e-mail hachée et
 * l'identifiant externe : jamais un nom, une photo, une conversation ni
 * une donnée de vérification d'identité.
 */
async function sha256(v: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(v.trim().toLowerCase()),
  );
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  /**
   * Deux appelants légitimes, deux preuves différentes.
   *
   *  • Le SERVEUR — webhook de paiement, tâches — présente le secret
   *    partagé. Il n'a pas de session utilisateur.
   *  • Le NAVIGATEUR présente le jeton de session du membre connecté.
   *
   * Dans le second cas, l'identité est déduite du JETON, jamais du corps
   * de la requête : sinon n'importe qui pourrait attribuer une conversion
   * au compte de quelqu'un d'autre.
   */
  const db0 = createClient(SUPABASE_URL, SERVICE_KEY);
  const secretFourni = (req.headers.get("x-push-secret") ?? "") === SECRET && !!SECRET;

  let identiteJeton: { id: string; email?: string } | null = null;

  if (!secretFourni) {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) return new Response("Forbidden", { status: 403 });

    const { data: u, error } = await db0.auth.getUser(jwt);
    if (error || !u?.user) return new Response("Forbidden", { status: 403 });
    identiteJeton = { id: u.user.id, email: u.user.email ?? undefined };
  }

  let c: {
    event_name?: string;
    event_id?: string;
    user_id?: string | null;
    email?: string | null;
    fbclid?: string | null;
    fbp?: string | null;
    phone?: string | null;
    value_xof?: number | null;
    source_url?: string | null;
    test?: boolean;
  };
  try { c = await req.json(); } catch { return new Response("JSON invalide", { status: 400 }); }

  const nom = c.event_name ?? "";
  if (!EVENEMENTS.has(nom)) {
    return json({ ok: false, raison: "evenement_inconnu" }, 400);
  }
  if (!c.event_id) return json({ ok: false, raison: "event_id_requis" }, 400);

  if (nom === "Purchase" && !secretFourni) {
    // Un achat n existe que lorsque l encaissement est confirme par le
    // prestataire. L accepter depuis un navigateur reviendrait a compter
    // une vente a chaque clic sur « Payer ».
    return json({ ok: false, raison: "purchase_serveur_uniquement" }, 403);
  }

  // L identite prime sur le corps de la requete quand elle vient d un
  // jeton : le client ne choisit pas a qui attribuer sa conversion.
  const userId = identiteJeton ? identiteJeton.id : (c.user_id ?? null);
  const email  = identiteJeton ? identiteJeton.email : (c.email ?? null);

  const db = db0;

  // Réglages publics : identifiant du Pixel, mode, code de test.
  const { data: reglages } = await db
    .from("app_settings").select("key, value")
    .in("key", ["meta_pixel_id", "meta_mode", "meta_test_code", "meta_capi_active"]);

  const r: Record<string, any> = {};
  (reglages ?? []).forEach((x: any) => { r[x.key] = x.value; });

  const pixel = String(r.meta_pixel_id ?? "").trim();
  const actif = r.meta_capi_active === true;
  const modeTest = c.test === true || r.meta_mode === "test";

  // Réserver la ligne AVANT l'appel réseau : si deux webhooks arrivent
  // en même temps pour la même vente, un seul passera.
  const { data: reserve } = await db.rpc("journaliser_meta_event", {
    p_event_name: nom,
    p_event_id: c.event_id,
    p_user_id: userId,
    p_source: c.test ? "test" : "server",
    p_status: "pending",
    p_value_xof: c.value_xof ?? null,
  });

  if (reserve === false) {
    return json({ ok: true, deja_envoye: true });
  }

  const finir = async (statut: string, http?: number, code?: string, msg?: string, ref?: string) => {
    await db.from("meta_conversion_events")
      .update({
        status: statut, http_status: http ?? null,
        error_code: code ?? null, error_message: msg ? msg.slice(0, 500) : null,
        meta_reference: ref ?? null,
        sent_at: statut === "sent" ? new Date().toISOString() : null,
      })
      .eq("event_id", c.event_id!)
      .eq("source", c.test ? "test" : "server");
  };

  if (!pixel || !TOKEN || !actif) {
    await finir("skipped", null, "non_configure",
      !pixel ? "Pixel non renseigné"
        : !TOKEN ? "Jeton d'accès absent"
        : "Conversions API désactivée");
    return json({ ok: false, raison: "non_configure" });
  }

  // ── Données de correspondance ──
  //
  // Meta calcule un « Event Match Quality » : plus il peut rapprocher un
  // événement d'une personne réelle, mieux il optimise. Chaque paramètre
  // absent dégrade ce score, donc la performance des campagnes.
  //
  // Rien de superflu n'est transmis pour autant : ni nom, ni photo, ni
  // message, ni donnée de vérification d'identité. Ce qui part est haché
  // en SHA-256 quand il s'agit d'une donnée personnelle — Meta ne peut
  // alors que la rapprocher de ce qu'il détient déjà, jamais la lire.
  const user_data: Record<string, unknown> = {};
  if (email) user_data.em = [await sha256(email)];
  if (userId) user_data.external_id = [await sha256(userId)];

  // Le numéro n'est connu qu'au paiement Mobile Money. Normalisé avant
  // hachage — Meta attend des chiffres uniquement, sinon « +228 96 47 95 »
  // et « 22896479 5 » produiraient deux empreintes différentes.
  if (c.phone) user_data.ph = [await sha256(c.phone.replace(/[^0-9]/g, ""))];

  // Identifiants de navigateur. `fbc` retient le clic publicitaire,
  // `fbp` le visiteur : ce sont les deux signaux qui rattachent une
  // conversion serveur à une impression précise.
  if (c.fbclid) user_data.fbc = c.fbclid;
  if (c.fbp) user_data.fbp = c.fbp;

  // Adresse IP et agent utilisateur : UNIQUEMENT pour les événements
  // venus du navigateur.
  //
  // Pour un événement serveur — Purchase, déclenché par le webhook de
  // paiement — l'adresse observée serait celle du prestataire, pas celle
  // du membre. L'envoyer ferait CHUTER la qualité de correspondance, en
  // rattachant toutes les ventes à une même machine.
  if (identiteJeton) {
    const ip = (req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-forwarded-for")
      ?? "").split(",")[0].trim();
    const ua = req.headers.get("user-agent") ?? "";
    if (ip) user_data.client_ip_address = ip;
    if (ua) user_data.client_user_agent = ua;
  }

  const charge: Record<string, unknown> = {
    data: [{
      event_name: nom,
      event_time: Math.floor(Date.now() / 1000),
      event_id: c.event_id,
      action_source: "website",
      event_source_url: c.source_url ?? "https://agapemeet.com",
      user_data,
      ...(c.value_xof
        ? { custom_data: { value: c.value_xof, currency: "XOF" } }
        : {}),
    }],
  };

  // Le code de test isole l'envoi dans l'outil de test de Meta : il
  // n'entre pas dans les statistiques du compte publicitaire.
  const codeTest = String(r.meta_test_code ?? "").trim();
  if (modeTest && codeTest) charge.test_event_code = codeTest;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API}/${pixel}/events?access_token=${encodeURIComponent(TOKEN)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(charge),
      },
    );

    const corps = await res.json().catch(() => ({}));

    if (!res.ok) {
      const e = corps?.error ?? {};
      // Le message de Meta est journalisé, jamais le jeton — l'URL qui le
      // contient n'est pas reproduite dans l'erreur.
      await finir("failed", res.status, String(e.code ?? ""), e.message ?? "Erreur Meta");
      console.error("[meta-capi]", nom, res.status, e.message);
      return json({ ok: false, http: res.status, message: e.message ?? "Erreur Meta" });
    }

    await finir("sent", res.status, undefined, undefined, corps?.fbtrace_id ?? null);
    return json({ ok: true, recus: corps?.events_received ?? 1, test: modeTest });
  } catch (e: any) {
    await finir("failed", null, "reseau", e?.message ?? "Appel impossible");
    console.error("[meta-capi] réseau:", e);
    return json({ ok: false, raison: "reseau" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "Content-Type": "application/json" },
  });
}
