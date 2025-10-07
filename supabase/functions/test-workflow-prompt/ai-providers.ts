
import { callOpenAI, callOpenAIWithMCP } from "./services/providers/openAIProvider.ts";

/**
 * Cost per 1k tokens for different models (in USD)
 */
const MODEL_COSTS = {
  'gpt-5-2025-08-07': { prompt: 0.03, completion: 0.06 },
  'gpt-5-mini-2025-08-07': { prompt: 0.01, completion: 0.03 },
  'gpt-5-nano-2025-08-07': { prompt: 0.005, completion: 0.015 },
  'gpt-4o': { prompt: 0.03, completion: 0.06 },
  'gpt-4o-mini': { prompt: 0.01, completion: 0.03 }
};

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = MODEL_COSTS[model] || { prompt: 0, completion: 0 };
  return (
    (promptTokens * costs.prompt) / 1000 +
    (completionTokens * costs.completion) / 1000
  );
}

export async function callAIProvider(aiProvider: string, aiModel: string, prompt: string): Promise<string> {
  console.log(`Calling ${aiProvider} with model ${aiModel}`);
  
  if (aiProvider !== "openai") {
    throw new Error(`Only OpenAI provider is supported, received: ${aiProvider}`);
  }
  
  return await callOpenAI(prompt, aiModel);
}

export async function callAIProviderWithMCP(
  aiProvider: string, 
  aiModel: string, 
  mcpContext: any
): Promise<any> {
  console.log(`Calling ${aiProvider} with MCP, using model ${aiModel}`);
  
  if (aiProvider !== "openai") {
    throw new Error(`Only OpenAI provider is supported for MCP, received: ${aiProvider}`);
  }
  
  return await callOpenAIWithMCP(mcpContext, aiModel);
}
