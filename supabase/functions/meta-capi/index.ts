import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

/**
 * Hachage SHA-256 standard requis par Meta Graph API.
 * Normalise la chaîne (minuscules, espaces retirés) avant hachage.
 */
async function sha256(str: string): Promise<string> {
  const clean = str.trim().toLowerCase()
  const msgUint8 = new TextEncoder().encode(clean)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Normalise un numéro de téléphone en format international E.164
 * (ex: +225... -> 225...) puis le hache en SHA-256.
 */
async function normaliserEtHacherTel(phone: string): Promise<string | null> {
  if (!phone) return null
  const chiffres = phone.replace(/[^0-9]/g, "")
  if (!chiffres || chiffres.length < 6) return null
  return await sha256(chiffres)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // 1. Lire la configuration dans app_settings
    const { data: reglagesData } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .like("key", "meta_%")

    const reglages: Record<string, any> = {}
    ;(reglagesData ?? []).forEach((row: any) => {
      reglages[row.key] = row.value
    })

    const pixelId = String(reglages.meta_pixel_id ?? "").trim()
    const capiActive = reglages.meta_capi_active === true
    const mode = String(reglages.meta_mode ?? "test")
    const testEventCode = String(reglages.meta_test_code ?? "").trim()

    // Jeton d'accès Meta (issu des variables d'environnement / secrets Supabase)
    const accessToken = Deno.env.get("META_ACCESS_TOKEN")

    const body = await req.json().catch(() => ({}))
    const {
      event_name,
      event_id,
      value_xof,
      fbclid,
      fbp,
      phone,
      email,
      source_url,
      test: isTestManual,
    } = body

    if (!event_name) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing event_name" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Vérifier si Meta CAPI est configuré
    if (!pixelId || !accessToken) {
      console.warn("[meta-capi] Non configuré : pixelId ou META_ACCESS_TOKEN manquant")
      return new Response(
        JSON.stringify({
          ok: false,
          raison: "non_configure",
          message: "Meta Pixel ID ou META_ACCESS_TOKEN manquant dans les secrets",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // Si CAPI est désactivé dans les paramètres et que ce n'est pas un test explicite du dashboard
    if (!capiActive && !isTestManual) {
      return new Response(
        JSON.stringify({ ok: false, raison: "capi_desactive", message: "Conversions API est désactivée" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // 2. Extraire l'IP et le User-Agent de la requête entrante
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
    const clientUserAgent = req.headers.get("user-agent") || null

    // 3. Préparer les données utilisateur (UserData)
    const userData: Record<string, any> = {}

    if (clientIp) userData.client_ip_address = clientIp
    if (clientUserAgent) userData.client_user_agent = clientUserAgent
    if (fbp) userData.fbp = fbp
    if (fbclid) userData.fbc = `fb.1.${Date.now()}.${fbclid}`

    if (email) {
      userData.em = [await sha256(email)]
    }
    if (phone) {
      const hashedPhone = await normaliserEtHacherTel(phone)
      if (hashedPhone) userData.ph = [hashedPhone]
    }

    // 4. Préparer le payload de l'événement
    const eventTime = Math.floor(Date.now() / 1000)
    const eventData: Record<string, any> = {
      event_name,
      event_time: eventTime,
      event_id: event_id || `${event_name.toLowerCase()}_${crypto.randomUUID().slice(0, 12)}`,
      event_source_url: source_url || undefined,
      action_source: "website",
      user_data: userData,
    }

    // Données spécifiques de conversion de valeur
    if (typeof value_xof === "number" && value_xof > 0) {
      eventData.custom_data = {
        value: value_xof,
        currency: "XOF",
      }
    }

    // 5. Préparation de la requête vers l'API Meta Graph v19.0
    const payload: Record<string, any> = {
      data: [eventData],
    }

    // Code de test (si mode test ou test explicite)
    const activeTestCode = isTestManual || mode === "test" ? testEventCode : null
    if (activeTestCode) {
      payload.test_event_code = activeTestCode
    }

    const metaGraphUrl = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`

    const response = await fetch(metaGraphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error("[meta-capi] Erreur API Meta:", result)
      return new Response(
        JSON.stringify({
          ok: false,
          error: result?.error?.message || "Erreur Meta API",
          details: result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        test: Boolean(activeTestCode),
        events_received: result.events_received ?? 1,
        fbtrace_id: result.fbtrace_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error: any) {
    console.error("[meta-capi] Erreur interne:", error)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
