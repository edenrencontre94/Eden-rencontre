import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { PRODUCTS_TO_OFFERS, CHARIOW_WEBHOOK_SECRET } from '../_shared/chariow.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

serve(async (req) => {
  try {
    const payload = await req.json()
    
    // Le payload d'un webhook Chariow (Pulse) contient un event
    const eventType = payload.event || payload.type
    
    // On ne s'intéresse qu'aux paiements complétés
    if (eventType !== 'order.completed' && eventType !== 'payment.success') {
      return new Response('Event ignored', { status: 200 })
    }

    const order = payload.data?.order || payload.data || payload
    const productId = order.product?.id || order.product_id
    const metadata = order.metadata || order.product?.metadata || order.customer?.metadata

    if (!productId) {
      throw new Error('Missing product_id in webhook payload')
    }

    // Si on n'a pas les metadata, on essaie de chercher l'utilisateur par son email
    let userId = metadata?.user_id
    const email = order.customer?.email || order.email

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (!userId && email) {
      // Retrouver le user_id depuis la table profiles
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()
      
      if (profile) userId = profile.id
    }

    if (!userId) {
      throw new Error(`Missing user_id and could not resolve from email: ${email}`)
    }

    const offerInfo = PRODUCTS_TO_OFFERS[productId]
    if (!offerInfo) {
      throw new Error(`Unknown product_id: ${productId}`)
    }

    // Récupérer l'abonnement actuel pour prolonger la date si déjà actif
    const { data: currentSub } = await supabaseAdmin
      .from('subscriptions')
      .select('expires_at')
      .eq('user_id', userId)
      .maybeSingle()

    let baseDate = new Date()
    if (currentSub?.expires_at) {
      const currentExp = new Date(currentSub.expires_at)
      if (currentExp > baseDate) {
        baseDate = currentExp // Prolongation
      }
    }

    baseDate.setDate(baseDate.getDate() + offerInfo.days)
    const newExpiresAt = baseDate.toISOString()

    // Mettre à jour l'abonnement (Upsert)
    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan_id: offerInfo.planId,
        level: offerInfo.level,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (upsertError) {
      throw new Error(`Erreur lors de la mise à jour de l'abonnement: ${upsertError.message}`)
    }
    
    // Log le paiement (optionnel)
    await supabaseAdmin.from('payments').insert({
      user_id: userId,
      amount: order.payment?.amount?.value || 0,
      currency: order.payment?.amount?.currency || 'XOF',
      plan_id: offerInfo.planId,
      level: offerInfo.level,
      status: 'completed',
      chariow_order_id: order.id || 'unknown'
    }).catch(() => {}) // On ignore l'erreur si la table n'existe pas

    return new Response(JSON.stringify({ success: true, newExpiresAt }), { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
