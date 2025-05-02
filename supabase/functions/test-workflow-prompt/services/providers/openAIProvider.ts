
import { executeMCPRequest } from "../mcpService.ts";
import { processStandardRequest } from "./openai/standardRequest.ts";

/**
 * Process an AI request using OpenAI
 * @param prompt The prompt text
 * @param model The OpenAI model to use
 * @param supabase The Supabase client
 * @param promptRunId The prompt run ID
 * @param projectId Optional project ID
 * @param useMCP Whether to use MCP
 * @param contextData Context data for MCP
 * @returns The AI response
 */
export async function processOpenAIRequest(
  prompt: string,
  model: string,
  supabase: any,
  promptRunId: string,
  projectId?: string,
  useMCP: boolean = false,
  contextData: any = {}
) {
  console.log(`Processing ${useMCP ? 'MCP' : 'standard'} OpenAI request with model: ${model}`);
  
  // Check whether to use MCP or standard request
  if (useMCP) {
    return await executeMCPRequest(
      supabase,
      projectId || '',
      contextData,
      'openai',
      model,
      promptRunId
    );
  } else {
    return await processStandardRequest(
      prompt,
      model,
      supabase,
      promptRunId,
      projectId
    );
  }
}
