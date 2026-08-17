import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

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

    // Vérifier que l'appelant est un admin/staff
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { data: isStaff } = await supabase.rpc('is_staff')
    if (!isStaff) throw new Error('Forbidden')

    const { title, message, segment, channels } = await req.json()
    if (!title || !message) throw new Error('Missing title or message')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Enregistrer la campagne dans la table campaigns
    const { data: campaign, error: insertError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        title,
        message,
        segment: segment || 'all',
        channels: channels || ['email'],
        sent_by: user.id,
        sent_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Erreur insertion campagne:', insertError)
      // On continue quand même l'envoi, la table peut manquer dans certains environnements
    }

    console.log(`[send-campaign] Campagne "${title}" préparée pour le segment ${segment}. Canaux: ${channels?.join(',')}`)
    
    // TODO: Implémenter la boucle sur les utilisateurs du segment et l'envoi via Resend/OneSignal/VAPID
    // Pour l'instant, c'est un mock (simule l'envoi)
    
    // Simuler le délai d'envoi
    await new Promise(resolve => setTimeout(resolve, 1000))

    return new Response(JSON.stringify({ success: true, message: 'Campagne envoyée avec succès' }), {
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
