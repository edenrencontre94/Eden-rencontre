export const CHARIOW_API_KEY = Deno.env.get('CHARIOW_API_KEY') || ''
export const CHARIOW_WEBHOOK_SECRET = Deno.env.get('CHARIOW_WEBHOOK_SECRET') || ''

// Map local offer IDs to Chariow Product IDs
export const OFFERS_TO_PRODUCTS: Record<string, string> = {
  'premium_15j': 'prd_yesaplkq',
  'premium_1m': 'prd_8r2nnv8m',
  'premium_3m': 'prd_w2nbog3t',
}

// Map Chariow Product IDs back to local offers
export const PRODUCTS_TO_OFFERS: Record<string, { planId: string, level: number, duration: string, days: number }> = {
  'prd_yesaplkq': { planId: 'premium', level: 1, duration: '15j', days: 15 },
  'prd_8r2nnv8m': { planId: 'premium', level: 2, duration: '1m', days: 30 },
  'prd_w2nbog3t': { planId: 'premium', level: 3, duration: '3m', days: 90 },
}
