import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { CHARIOW_API_KEY, OFFERS_TO_PRODUCTS } from '../_shared/chariow.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new Error('Unauthorized')
    }


    const { offerId, phone, countryCode } = await req.json()
    const productId = OFFERS_TO_PRODUCTS[offerId]
    if (!productId) {
      throw new Error('Invalid offer')
    }

    const payload = {
      product_id: productId,
      email: user.email || `user_${user.id}@edenrencontre.com`,
      first_name: user.user_metadata?.first_name || 'Membre',
      last_name: user.user_metadata?.last_name || 'Eden',
      phone: {
        number: phone,
        country_code: countryCode
      },
      metadata: {
        user_id: user.id,
        offer_id: offerId
      }
    }

    const response = await fetch('https://api.chariow.com/v1/checkout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHARIOW_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}))
      const errMsg = errBody.message || await response.text()
      throw new Error(`Erreur Chariow: ${errMsg}`)
    }

    const result = await response.json()
    const checkoutUrl = result.data?.payment?.checkout_url
    
    if (!checkoutUrl) {
      throw new Error('Aucun lien de paiement généré par Chariow')
    }

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
