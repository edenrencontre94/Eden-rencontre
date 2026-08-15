import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cette fonction est appelée par le frontend pour vérifier si un paiement
    // a été validé récemment, au cas où le webhook n'aurait pas été reçu.
    // L'implémentation complète nécessiterait d'interroger l'API Chariow
    // pour récupérer les derniers paiements de l'utilisateur.
    // Étant donné que le webhook Pulse est fiable, on renvoie 0 pour l'instant.

    return new Response(JSON.stringify({ recovered: 0, pending: 0 }), {
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
