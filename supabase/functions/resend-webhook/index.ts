import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"
import { Webhook } from "https://esm.sh/svix@1.15.0"

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const payload = await req.text()
  const headers = {
    "svix-id": req.headers.get("svix-id") || "",
    "svix-timestamp": req.headers.get("svix-timestamp") || "",
    "svix-signature": req.headers.get("svix-signature") || "",
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('Missing RESEND_WEBHOOK_SECRET')
    return new Response('Server Error', { status: 500 })
  }

  let event;
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(payload, headers) as any
  } catch (err) {
    console.error('Invalid signature:', err.message)
    return new Response('Invalid signature', { status: 401 })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const type = event.type
    // Resend met l'adresse du destinataire dans data.to[0]
    const emailTo = event.data?.to?.[0]

    console.log(`[resend-webhook] Received event ${type} for email ${emailTo}`)

    // On s'intéresse aux événements graves : bounce (n'existe pas/rejeté) ou complaint (marqué spam)
    if (type === 'email.bounced' || type === 'email.complained') {
      if (!emailTo) throw new Error('No email address found in event')

      // Chercher l'utilisateur avec cet email
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', emailTo)
      
      if (profileErr) throw profileErr

      for (const p of profiles || []) {
        // Désactiver TOUTES les préférences d'email pour cet utilisateur
        const { error: updateErr } = await supabaseAdmin
          .from('email_preferences')
          .upsert({
            user_id: p.id,
            new_match: false,
            new_message: false,
            new_like: false,
            community_digest: false,
            promotions: false,
            updated_at: new Date().toISOString()
          })
        
        if (updateErr) {
          console.error(`Failed to update email_preferences for user ${p.id}`, updateErr)
        } else {
          console.log(`[resend-webhook] Disabled all emails for user ${p.id} (${emailTo}) due to ${type}`)
        }
      }
    } else if (type === 'email.delivered') {
      // Optionnel : on pourrait traquer la délivrabilité exacte dans la DB ici
      console.log(`[resend-webhook] Email delivered to ${emailTo}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('[resend-webhook] Error processing event:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
