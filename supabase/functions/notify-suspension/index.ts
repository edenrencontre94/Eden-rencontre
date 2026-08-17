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

    const { userId, reason, until } = await req.json()
    if (!userId) throw new Error('Missing userId')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer l'email de l'utilisateur pour lui envoyer un mail (via Resend, Sendgrid, etc.)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single()
    
    console.log(`[notify-suspension] Utilisateur ${userId} (${profile?.email}) suspendu pour la raison: ${reason}. Jusqu'au: ${until || 'Définitif'}`)
    
    // TODO: Implémenter l'envoi d'email avec un fournisseur externe (Resend, Sendgrid)
    // Exemple avec Resend:
    /*
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_API_KEY && profile?.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Eden Rencontre <support@edenrencontres.com>',
          to: profile.email,
          subject: 'Votre compte a été suspendu',
          html: `<p>Bonjour ${profile.first_name},</p><p>Votre compte a été suspendu pour la raison suivante : <b>${reason}</b>.</p>`
        })
      })
    }
    */

    return new Response(JSON.stringify({ success: true }), {
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
