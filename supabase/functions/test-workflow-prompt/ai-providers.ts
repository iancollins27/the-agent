
import { callOpenAI, callOpenAIWithMCP } from "./services/providers/openAIProvider.ts";
import { callClaude, callClaudeWithMCP } from "./services/providers/claudeProvider.ts";
import { corsHeaders } from "./index.ts";

/**
 * Cost per 1k tokens for different models (in USD)
 */
const MODEL_COSTS = {
  'gpt-4o': { prompt: 0.03, completion: 0.06 },
  'gpt-4o-mini': { prompt: 0.01, completion: 0.03 },
  'claude-3-haiku-20240307': { prompt: 0.0025, completion: 0.0025 },
  'claude-3-5-haiku-20241022': { prompt: 0.0025, completion: 0.0025 }
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
  
  switch (aiProvider) {
    case "openai":
      return await callOpenAI(prompt, aiModel);
    case "claude":
      return await callClaude(prompt, aiModel);
    default:
      throw new Error(`Unknown AI provider: ${aiProvider}`);
  }
}

export async function callAIProviderWithMCP(
  aiProvider: string, 
  aiModel: string, 
  mcpContext: any
): Promise<any> {
  console.log(`Calling ${aiProvider} with MCP, using model ${aiModel}`);
  
  switch (aiProvider) {
    case "openai":
      return await callOpenAIWithMCP(mcpContext, aiModel);
    case "claude":
      return await callClaudeWithMCP(mcpContext, aiModel);
    default:
      throw new Error(`MCP not supported for provider: ${aiProvider}`);
  }
}
