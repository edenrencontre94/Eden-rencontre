import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { CHARIOW_API_KEY, PRODUCTS_TO_OFFERS } from '../_shared/chariow.ts'
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier l'utilisateur
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    let recovered = 0

    // Si une clé d'API Chariow est configurée, interroger Chariow
    if (CHARIOW_API_KEY) {
      try {
        const response = await fetch(`https://api.chariow.com/v1/orders?customer_email=${encodeURIComponent(user.email || '')}`, {
          headers: {
            'Authorization': `Bearer ${CHARIOW_API_KEY}`,
            'Accept': 'application/json'
          }
        })

        if (response.ok) {
          const resJson = await response.json()
          const orders = resJson.data || resJson.orders || []
          
          for (const order of orders) {
            const status = (order.status || '').toLowerCase()
            if (status === 'completed' || status === 'paid') {
              const orderId = order.id || order.order?.id
              // Vérifier si ce paiement est déjà enregistré
              const { data: existing } = await supabaseAdmin
                .from('payments')
                .select('id')
                .eq('chariow_order_id', orderId)
                .maybeSingle()

              if (!existing) {
                const productId = order.product?.id || order.product_id
                const offerInfo = PRODUCTS_TO_OFFERS[productId] || { planId: 'premium', level: 2, duration: '1m', days: 30 }
                
                let amount = order.payment?.amount?.value || order.amount || 4000
                if (typeof amount === 'string') amount = parseFloat(amount) || 4000

                // Prolonger le profil
                const { data: cur } = await supabaseAdmin.from('profiles').select('premium_until').eq('id', user.id).maybeSingle()
                let base = new Date()
                if (cur?.premium_until && new Date(cur.premium_until) > base) {
                  base = new Date(cur.premium_until)
                }
                base.setDate(base.getDate() + offerInfo.days)

                await supabaseAdmin.from('profiles').update({
                  public_plan: 'premium',
                  premium_until: base.toISOString(),
                  updated_at: new Date().toISOString()
                }).eq('id', user.id)

                await supabaseAdmin.from('payments').insert({
                  user_id: user.id,
                  amount_xof: amount,
                  currency: 'XOF',
                  offer_id: `premium_${offerInfo.duration}`,
                  plan_id: 'premium',
                  status: 'completed',
                  chariow_order_id: orderId,
                  completed_at: new Date().toISOString()
                })

                recovered++
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[chariow-reconcile] Fetch orders warning:', err.message)
      }
    }

    return new Response(JSON.stringify({ recovered, pending: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
