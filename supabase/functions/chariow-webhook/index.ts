import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { PRODUCTS_TO_OFFERS } from '../_shared/chariow.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

serve(async (req) => {
  // Toujours répondre avec CORS ou 200 pour les tests et OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const rawBody = await req.text()
    if (!rawBody || rawBody.trim() === '') {
      return new Response(JSON.stringify({ message: 'Empty body' }), { status: 200 })
    }

    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch (e) {
      console.error('[chariow-webhook] Failed to parse JSON body:', rawBody)
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
    }

    console.log('[chariow-webhook] Received payload:', JSON.stringify(payload))

    // Types d'événements supportés par Chariow (Pulse / Webhooks)
    const eventType = (payload.event || payload.type || '').toLowerCase()
    
    // Si ce n'est pas un événement de paiement complété, on accuse réception proprement
    const isCompletedEvent = 
      eventType === 'order.completed' || 
      eventType === 'order.paid' || 
      eventType === 'payment.success' || 
      eventType === 'payment.completed' ||
      eventType === 'checkout.completed' ||
      payload.status === 'completed' ||
      payload.status === 'paid'

    if (!isCompletedEvent && eventType !== '') {
      console.log(`[chariow-webhook] Event "${eventType}" ignored (not completed)`)
      return new Response(JSON.stringify({ message: `Event ${eventType} ignored` }), { status: 200 })
    }

    // Récupérer l'objet commande / transaction sous différents formats possibles
    const order = payload.data?.order || payload.data?.payment || payload.data || payload
    
    // Résolution du product_id
    const productId = 
      order.product?.id || 
      order.product_id || 
      order.items?.[0]?.product_id || 
      order.items?.[0]?.product?.id ||
      payload.product_id ||
      payload.data?.product_id

    // Résolution des métadonnées
    const metadata = 
      order.metadata || 
      order.product?.metadata || 
      payload.metadata || 
      payload.data?.metadata || 
      {}

    console.log('[chariow-webhook] ProductId:', productId, 'Metadata:', JSON.stringify(metadata))

    // Informations sur l'offre
    let offerInfo = productId ? PRODUCTS_TO_OFFERS[productId] : null
    
    // Si l'id produit n'est pas reconnu mais qu'on a l'offer_id dans les metadata
    if (!offerInfo && metadata?.offer_id) {
      if (metadata.offer_id === 'premium_15j') offerInfo = { planId: 'premium', level: 1, duration: '15j', days: 15 }
      else if (metadata.offer_id === 'premium_1m') offerInfo = { planId: 'premium', level: 2, duration: '1m', days: 30 }
      else if (metadata.offer_id === 'premium_3m') offerInfo = { planId: 'premium', level: 3, duration: '3m', days: 90 }
    }

    // Fallback par défaut si aucune offre identifiée
    if (!offerInfo) {
      offerInfo = { planId: 'premium', level: 2, duration: '1m', days: 30 }
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Résolution du user_id
    let userId = metadata?.user_id
    const email = order.customer?.email || order.email || payload.customer?.email || payload.email

    if (!userId && email) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      
      if (profile) userId = profile.id
    }

    // Si on a le numéro de téléphone du client
    if (!userId) {
      const phone = order.customer?.phone?.number || order.phone?.number || order.phone || payload.phone
      if (phone) {
        const cleanPhone = String(phone).replace(/[^0-9]/g, '')
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .ilike('phone', `%${cleanPhone.slice(-8)}%`)
          .maybeSingle()
        if (profile) userId = profile.id
      }
    }

    if (!userId) {
      console.error('[chariow-webhook] Could not resolve user. Order data:', JSON.stringify(order))
      throw new Error(`Cannot resolve user from metadata, email (${email}) or phone`)
    }

    // Calculer la nouvelle date d'expiration Premium
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('premium_until')
      .eq('id', userId)
      .maybeSingle()

    let baseDate = new Date()
    if (currentProfile?.premium_until) {
      const currentExp = new Date(currentProfile.premium_until)
      if (currentExp > baseDate) {
        baseDate = currentExp // Prolonge l'abonnement en cours
      }
    }

    baseDate.setDate(baseDate.getDate() + (offerInfo.days || 30))
    const newPremiumUntil = baseDate.toISOString()

    // 1. Mise à jour du profil utilisateur
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        public_plan: offerInfo.planId || 'premium',
        premium_until: newPremiumUntil,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[chariow-webhook] Profile update error:', updateError)
    }

    // 2. Extraire le montant payé
    let paymentAmount = 
      order.payment?.amount?.value ?? 
      order.order?.payment?.amount?.value ?? 
      order.amount?.value ?? 
      order.amount ?? 
      payload.amount ?? 
      0

    if (typeof paymentAmount === 'string') {
      paymentAmount = parseFloat(paymentAmount) || 0
    }

    // Si le montant n'est pas fourni dans le webhook, appliquer le montant de l'offre
    if (paymentAmount <= 0) {
      if (offerInfo.duration === '15j') paymentAmount = 2500
      else if (offerInfo.duration === '1m') paymentAmount = 4000
      else if (offerInfo.duration === '3m') paymentAmount = 9000
      else paymentAmount = 4000
    }

    const chariowOrderId = String(order.id || order.order?.id || payload.order_id || payload.id || `ch_${Date.now()}`)

    // 3. Enregistrer ou mettre à jour dans la table payments
    const offerIdStr = metadata?.offer_id || `premium_${offerInfo.duration || '1m'}`
    const { error: insertPayError } = await supabaseAdmin
      .from('payments')
      .upsert({
        user_id: userId,
        amount_xof: paymentAmount,
        currency: 'XOF',
        offer_id: offerIdStr,
        plan_id: offerInfo.planId || 'premium',
        status: 'completed',
        chariow_order_id: chariowOrderId,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        metadata: {
          chariow_event: eventType,
          product_id: productId,
          ...metadata
        }
      }, { onConflict: 'chariow_order_id' })

    if (insertPayError) {
      console.error('[chariow-webhook] Payment insert/upsert error:', insertPayError)
      // Si la contrainte unique sur chariow_order_id n'existe pas, faire un insert standard
      await supabaseAdmin.from('payments').insert({
        user_id: userId,
        amount_xof: paymentAmount,
        currency: 'XOF',
        offer_id: offerIdStr,
        plan_id: offerInfo.planId || 'premium',
        status: 'completed',
        chariow_order_id: chariowOrderId,
        completed_at: new Date().toISOString(),
      }).catch(e => console.error('[chariow-webhook] Direct insert retry error:', e))
    }

    console.log(`[chariow-webhook] Success! Activated premium for user ${userId} until ${newPremiumUntil}, logged payment ${paymentAmount} XOF`)

    // 4. Déclencher Meta CAPI si configuré
    try {
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('phone, fbclid')
        .eq('id', userId)
        .maybeSingle()

      await supabaseAdmin.functions.invoke('meta-capi', {
        body: {
          event_name: 'Purchase',
          event_id: `purchase_${chariowOrderId}`,
          value_xof: paymentAmount,
          fbclid: userProfile?.fbclid || null,
          phone: userProfile?.phone || null,
          email: email || null,
        }
      })
    } catch (e: any) {
      console.warn('[chariow-webhook] CAPI warning:', e.message)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId,
      amount: paymentAmount,
      newPremiumUntil 
    }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error: any) {
    console.error('[chariow-webhook] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})
