/**
 * CORS restreints au domaine Eden Rencontre.
 *
 * Le wildcard '*' acceptait n'importe quel appelant — un script
 * malveillant pouvait envoyer de faux événements ou appeler les
 * fonctions serveur depuis un domaine tiers.
 */
const ALLOWED_ORIGINS = [
  'https://edenrencontres.com',
  'https://www.edenrencontres.com',
  // Développement local uniquement — à retirer en production stricte
  'http://localhost:5173',
  'http://localhost:3000',
]

export function getCorsHeaders(req?: Request) {
  const origin = req?.headers?.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// Rétro-compatibilité : les fonctions existantes importent `corsHeaders`
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://edenrencontres.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
