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

    const { campaignId } = await req.json()
    if (!campaignId) throw new Error('Missing campaignId')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer la campagne
    const { data: campaign, error: fetchErr } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (fetchErr || !campaign) throw new Error('Campagne introuvable')
    if (campaign.status === 'sent') throw new Error('Campagne déjà envoyée')

    console.log(`[send-campaign] Lancement de la campagne "${campaign.subject}" pour le segment ${campaign.segment}`)
    
    // Déterminer les cibles
    let query = supabaseAdmin.from('profiles').select('email, first_name, id, last_seen')
    
    // Filtres simples selon le segment
    if (campaign.segment === 'active') {
      query = query.gte('last_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    } else if (campaign.segment === 'inactive') {
      query = query.lt('last_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    }
    // "all" ou par défaut: pas de filtre

    const { data: users, error: usersErr } = await query
    if (usersErr) throw usersErr

    const validUsers = (users || []).filter(u => u.email && u.email.includes('@'))
    let delivered = 0
    let skipped = (users?.length || 0) - validUsers.length

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_API_KEY && validUsers.length > 0) {
       // Préparation du batch
       const emails = validUsers.map(u => ({
         from: 'Eden Rencontre <contact@edenrencontres.com>',
         to: u.email,
         subject: campaign.subject,
         html: `<p>Bonjour ${u.first_name || 'membre'},</p><p>${campaign.body}</p>`
       }))

       const batchSize = 100
       for (let i = 0; i < emails.length; i += batchSize) {
         const batch = emails.slice(i, i + batchSize)
         const res = await fetch('https://api.resend.com/emails/batch', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${RESEND_API_KEY}`,
             'Content-Type': 'application/json'
           },
           body: JSON.stringify(batch)
         })
         
         if (res.ok) {
            delivered += batch.length
         } else {
            console.error('[send-campaign] Erreur batch Resend:', await res.text())
            skipped += batch.length
         }
       }
    } else if (!RESEND_API_KEY) {
      console.warn('[send-campaign] RESEND_API_KEY manquante, aucun email envoyé.')
      skipped += validUsers.length
    }

    // Mise à jour de la campagne
    await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'sent',
        recipients: validUsers.length + skipped,
        delivered,
        skipped,
        sent_at: new Date().toISOString()
      })
      .eq('id', campaign.id)

    return new Response(JSON.stringify({ success: true, delivered, skipped }), {
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
