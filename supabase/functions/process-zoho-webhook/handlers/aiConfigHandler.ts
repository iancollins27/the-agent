
import { AI_CONFIG, getAIApiKey } from '../../_shared/aiConfig.ts';

/**
 * Get OpenAI configuration
 * @returns Object containing AI provider, model, and API key
 */
export async function getAIConfig() {
  const aiProvider = AI_CONFIG.provider;
  const aiModel = AI_CONFIG.model;
  const apiKey = getAIApiKey();
  
  return { aiProvider, aiModel, apiKey };
}
