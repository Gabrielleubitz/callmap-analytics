/**
 * Pricing Configuration
 * 
 * Centralizes all pricing constants for plans and AI model token costs.
 * Used for economics calculations and revenue analysis.
 */

/**
 * Monthly recurring revenue (MRR) for each plan tier
 * Prices in USD per month
 */
export const PLAN_PRICES = {
  free: 0,
  pro: 29,
  team: 79,
  enterprise: 249,
} as const

export type Plan = keyof typeof PLAN_PRICES

/**
 * Token pricing per 1,000 tokens
 * Prices in USD
 * 
 * Structure: model -> { input: price per 1k tokens, output: price per 1k tokens }
 */
export const TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  "gpt-4o": {
    input: 0.0005, // $0.50 per 1M input tokens
    output: 0.0015, // $1.50 per 1M output tokens
  },
  "gpt-4o-mini": {
    input: 0.00015, // $0.15 per 1M input tokens
    output: 0.0006, // $0.60 per 1M output tokens
  },
  "gpt-4": {
    input: 0.03, // $30 per 1M input tokens
    output: 0.06, // $60 per 1M output tokens
  },
  "gpt-4-turbo": {
    input: 0.01, // $10 per 1M input tokens
    output: 0.03, // $30 per 1M output tokens
  },
  "gpt-3.5-turbo": {
    input: 0.0005, // $0.50 per 1M input tokens
    output: 0.0015, // $1.50 per 1M output tokens
  },
  // Default fallback for unknown models
  "default": {
    input: 0.0005,
    output: 0.0015,
  },
} as const

/**
 * Get token price for a model
 * Returns default pricing if model not found
 */
export function getTokenPrice(model: string): { input: number; output: number } {
  return TOKEN_PRICES[model] || TOKEN_PRICES["default"]
}

/**
 * Calculate token cost for a job
 * @param tokensIn - Input tokens
 * @param tokensOut - Output tokens
 * @param model - Model name
 * @returns Cost in USD
 */
export function calculateTokenCost(
  tokensIn: number,
  tokensOut: number,
  model: string
): number {
  const price = getTokenPrice(model)
  const inputCost = (tokensIn / 1000) * price.input
  const outputCost = (tokensOut / 1000) * price.output
  return inputCost + outputCost
}

/**
 * Get MRR for a plan
 */
export function getPlanMRR(plan: Plan): number {
  return PLAN_PRICES[plan] || 0
}

