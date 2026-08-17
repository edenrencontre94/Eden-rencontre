import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"
// Import de la librairie Agora pour la génération de tokens
// (On utilise esm.sh pour rendre les librairies Node compatibles avec Deno)
import pkg from "https://esm.sh/agora-access-token@2.0.4"
const { RtcTokenBuilder, RtcRole } = pkg

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { channel, role, type } = await req.json()
    if (!channel) throw new Error('Missing channel name')

    const appID = Deno.env.get('AGORA_APP_ID')
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE')

    if (!appID || !appCertificate) {
      throw new Error('Agora API keys not configured on server (AGORA_APP_ID, AGORA_APP_CERTIFICATE)')
    }

    // Le role "publisher" correspond à l'envoi de flux (host)
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER
    // Le token expire dans 1h (3600 secondes)
    const expirationTimeInSeconds = 3600
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

    // L'uid Agora doit être un entier. Puisque Supabase utilise des UUID (string), on génère 
    // l'uid 0 qui signifie qu'Agora attribuera un UID dynamique ou utilisera l'ID passé par le client.
    const uid = 0

    const token = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      channel,
      uid,
      agoraRole,
      privilegeExpiredTs
    )

    return new Response(JSON.stringify({ token, appId: appID }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Agora Token Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
