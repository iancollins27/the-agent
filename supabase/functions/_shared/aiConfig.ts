/**
 * Central AI model configuration
 * Change the model here and it applies everywhere.
 * Or set the AI_MODEL environment variable in Supabase secrets to override without code changes.
 */
export const AI_CONFIG = {
  provider: 'openai' as const,
  model: Deno.env.get('AI_MODEL') || 'gpt-5-nano-2025-08-07',
  apiKeyEnvVar: 'OPENAI_API_KEY',
};

/**
 * Cost per 1k tokens for supported models (in USD)
 */
export const MODEL_COSTS: Record<string, { prompt: number; completion: number }> = {
  'gpt-5-2025-08-07': { prompt: 0.03, completion: 0.06 },
  'gpt-5-mini-2025-08-07': { prompt: 0.01, completion: 0.03 },
  'gpt-5-nano-2025-08-07': { prompt: 0.005, completion: 0.015 },
  'gpt-4o': { prompt: 0.03, completion: 0.06 },
  'gpt-4o-mini': { prompt: 0.01, completion: 0.03 },
};

/**
 * Calculate cost for a given model and token usage
 * @param model The model name
 * @param promptTokens Number of prompt tokens
 * @param completionTokens Number of completion tokens
 * @returns Cost in USD
 */
export function calculateModelCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS[AI_CONFIG.model] || { prompt: 0, completion: 0 };
  return (promptTokens * costs.prompt) / 1000 + (completionTokens * costs.completion) / 1000;
}

/**
 * Get the OpenAI API key from environment
 */
export function getAIApiKey(): string {
  const key = Deno.env.get(AI_CONFIG.apiKeyEnvVar) ?? '';
  if (!key) {
    throw new Error(`${AI_CONFIG.apiKeyEnvVar} is not configured`);
  }
  return key;
}
