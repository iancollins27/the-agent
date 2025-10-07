
/**
 * Get OpenAI configuration
 * @returns Object containing AI provider, model, and API key
 */
export async function getAIConfig() {
  const aiProvider = 'openai';
  const aiModel = 'gpt-5-2025-08-07';
  
  const apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';

  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  
  return { aiProvider, aiModel, apiKey };
}
