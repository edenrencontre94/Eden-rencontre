import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { CHARIOW_API_KEY, PRODUCTS_TO_OFFERS } from '../_shared/chariow.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let totalImported = 0
    let totalUpdated = 0
    const logs: string[] = []

    // 1. Charger tous les utilisateurs Supabase Auth (jusqu'à 1000)
    const allUsers: any[] = []
    let page = 1
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 })
      if (error || !data?.users || data.users.length === 0) break
      allUsers.push(...data.users)
      if (data.users.length < 100) break
      page++
    }

    logs.push(`${allUsers.length} comptes auth récupérés sur Eden`)

    // 2. Charger les profils
    const { data: allProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, phone, first_name')

    // 3. Récupérer les ventes Chariow
    const response = await fetch('https://api.chariow.com/v1/sales?limit=100', {
      headers: {
        'Authorization': `Bearer ${CHARIOW_API_KEY}`,
        'Accept': 'application/json'
      }
    })

    const resJson = await response.json()
    const sales = resJson.data || resJson.sales || []

    logs.push(`${sales.length} ventes reçues de Chariow`)

    for (const sale of sales) {
      const chariowOrderId = String(sale.id || sale.sale_id || `sal_${Date.now()}`)
      const statusRaw = String(sale.status || sale.payment?.status || '').toLowerCase()
      const email = (sale.customer?.email || sale.email || sale.buyer?.email || '').trim().toLowerCase()
      const phoneRaw = String(sale.customer?.phone?.number || sale.customer?.phone || sale.phone || '').trim()
      const cleanPhone = phoneRaw.replace(/[^0-9]/g, '')
      const metadata = sale.metadata || {}

      let userId = metadata.user_id

      // A. Match par email dans auth.users
      if (!userId && email) {
        const found = allUsers.find(u => (u.email || '').toLowerCase() === email)
        if (found) userId = found.id
      }

      // B. Match par téléphone dans auth.users
      if (!userId && cleanPhone.length >= 8) {
        const found = allUsers.find(u => {
          const uPhone = String(u.phone || '').replace(/[^0-9]/g, '')
          return uPhone.length >= 8 && (uPhone.endsWith(cleanPhone.slice(-8)) || cleanPhone.endsWith(uPhone.slice(-8)))
        })
        if (found) userId = found.id
      }

      // C. Match par téléphone dans profiles
      if (!userId && cleanPhone.length >= 8 && allProfiles) {
        const found = allProfiles.find(p => {
          const pPhone = String(p.phone || '').replace(/[^0-9]/g, '')
          return pPhone.length >= 8 && (pPhone.endsWith(cleanPhone.slice(-8)) || cleanPhone.endsWith(pPhone.slice(-8)))
        })
        if (found) userId = found.id
      }

      // Seuls les statuts de paiement effectif : settled, completed, paid, success
      const isPaid = statusRaw === 'settled' || statusRaw === 'completed' || statusRaw === 'paid' || statusRaw === 'success'

      if (!userId) {
        logs.push(`Vente ${chariowOrderId} (${statusRaw}) : Aucun compte Eden correspondant pour email=${email}, phone=${phoneRaw}`)
        continue
      }

      const productId = sale.product?.id || sale.product_id || sale.items?.[0]?.product_id || sale.items?.[0]?.product?.id
      const offerInfo = (productId && PRODUCTS_TO_OFFERS[productId]) || { planId: 'premium', level: 2, duration: '1m', days: 30 }

      let amount = sale.amount?.value ?? sale.amount ?? sale.original_amount?.value ?? 4000
      if (typeof amount === 'string') amount = parseFloat(amount) || 4000

      const completedAt = sale.settlement?.done_at || sale.created_at || new Date().toISOString()

      // Insérer dans la table payments
      await supabaseAdmin.from('payments').upsert({
        user_id: userId,
        amount_xof: amount,
        currency: 'XOF',
        offer_id: `premium_${offerInfo.duration}`,
        plan_id: offerInfo.planId || 'premium',
        status: isPaid ? 'completed' : statusRaw,
        chariow_order_id: chariowOrderId,
        completed_at: isPaid ? completedAt : null,
        created_at: sale.created_at || completedAt,
        metadata: {
          imported_via: 'chariow-sync-history',
          raw_sale: sale
        }
      }, { onConflict: 'chariow_order_id' })

      totalImported++

      // Si payé, activer / prolonger Premium
      if (isPaid) {
        const { data: curProf } = await supabaseAdmin
          .from('profiles')
          .select('premium_until')
          .eq('id', userId)
          .maybeSingle()

        let expDate = new Date()
        if (curProf?.premium_until && new Date(curProf.premium_until) > expDate) {
          expDate = new Date(curProf.premium_until)
        }
        expDate.setDate(expDate.getDate() + offerInfo.days)

        await supabaseAdmin.from('profiles').update({
          public_plan: 'premium',
          premium_until: expDate.toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', userId)

        totalUpdated++
        logs.push(`-> Vente ${chariowOrderId} IMPORTÉE pour User ${userId} (${amount} FCFA, Premium actif jusqu'au ${expDate.toLocaleDateString()})`)
      } else {
        logs.push(`-> Vente ${chariowOrderId} enregistrée (${statusRaw}) pour User ${userId}`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalSalesFound: sales.length,
      imported: totalImported,
      usersUpdated: totalUpdated,
      logs
    }), {
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
