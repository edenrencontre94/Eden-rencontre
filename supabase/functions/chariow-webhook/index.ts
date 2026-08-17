import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { PRODUCTS_TO_OFFERS } from '../_shared/chariow.ts'
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
    const metadata = order.metadata || order.product?.metadata

    if (!productId) {
      throw new Error('Missing product_id in webhook payload')
    }

    const offerInfo = PRODUCTS_TO_OFFERS[productId]
    if (!offerInfo) {
      throw new Error(`Unknown product_id: ${productId}`)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Retrouver l'utilisateur via les metadata (user_id) ou son email
    let userId = metadata?.user_id
    const email = order.customer?.email || order.email

    if (!userId && email) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()
      
      if (profile) userId = profile.id
    }

    if (!userId) {
      throw new Error(`Cannot resolve user from metadata or email: ${email}`)
    }

    // Lire la date d'expiration actuelle pour prolonger si déjà premium
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('premium_until')
      .eq('id', userId)
      .single()

    let baseDate = new Date()
    if (currentProfile?.premium_until) {
      const currentExp = new Date(currentProfile.premium_until)
      if (currentExp > baseDate) {
        baseDate = currentExp // Prolongation depuis la date actuelle
      }
    }

    baseDate.setDate(baseDate.getDate() + offerInfo.days)
    const newPremiumUntil = baseDate.toISOString()

    // Mettre à jour le profil de l'utilisateur avec le nouveau statut premium
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        public_plan: 'premium',
        premium_until: newPremiumUntil,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour du profil: ${updateError.message}`)
    }

    // Enregistrer le paiement dans la table payments (optionnel, pour l'historique admin)
    await supabaseAdmin.from('payments').insert({
      user_id: userId,
      amount: order.payment?.amount?.value || order.order?.payment?.amount?.value || 0,
      currency: 'XOF',
      plan_id: offerInfo.planId,
      status: 'completed',
      chariow_order_id: order.id || order.order?.id || 'unknown'
    }).catch((e: any) => {
      console.warn('Could not insert payment log:', e.message)
    })

    console.log(`[chariow-webhook] Activated premium for user ${userId} until ${newPremiumUntil}`)

    return new Response(JSON.stringify({ 
      success: true, 
      userId,
      newPremiumUntil 
    }), { status: 200 })

  } catch (error) {
    console.error('Webhook error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
