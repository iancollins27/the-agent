import { processOpenAIRequest } from "./openai/index.ts";

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
    const { processMCPRequest } = await import("./openai/mcpRequest.ts");
    return await processMCPRequest(
      prompt,
      model,
      supabase,
      promptRunId,
      projectId || '',
      contextData
    );
  } else {
    const { processStandardRequest } = await import("./openai/standardRequest.ts");
    return await processStandardRequest(
      prompt,
      model,
      supabase,
      promptRunId,
      projectId
    );
  }
}

export { processOpenAIRequest };
