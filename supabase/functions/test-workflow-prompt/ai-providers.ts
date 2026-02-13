
import { callOpenAI, callOpenAIWithMCP } from "./services/providers/openAIProvider.ts";
import { AI_CONFIG, MODEL_COSTS, calculateModelCost } from '../_shared/aiConfig.ts';

export { calculateModelCost as calculateCost };

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
