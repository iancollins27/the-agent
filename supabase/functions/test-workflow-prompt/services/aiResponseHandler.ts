
import { searchKnowledgeBase } from "../knowledge-service.ts";
import { requestHumanReview } from "../human-service.ts";
import { createActionRecord, createReminder } from "../database/actions.ts";

export async function handleAIResponse(
  supabase: any,
  aiProvider: string,
  aiModel: string,
  prompt: string,
  promptRunId: string,
  projectId: string,
  promptType: string,
  useMCP: boolean,
  contextData: any
): Promise<{
  result: string;
  actionRecordId?: string;
  reminderSet?: boolean;
  nextCheckDateInfo?: any;
  humanReviewRequestId?: string;
  knowledgeResults?: any[];
  toolOutputs?: any[];
}> {
  console.log(`Handling ${useMCP ? 'MCP' : 'standard'} AI response for ${aiProvider}/${aiModel}`);
  
  try {
    // Based on the AI provider, use the appropriate module
    if (aiProvider.toLowerCase().includes("claude") || aiProvider.toLowerCase().includes("anthropic")) {
      const { processClaudeRequest } = await import("./providers/claudeProvider.ts");
      
      const response = await processClaudeRequest(
        prompt,
        aiModel,
        supabase,
        promptRunId,
        projectId,
        useMCP,
        contextData
      );
      
      if (useMCP && response.toolOutputs) {
        return processToolOutputs(supabase, response.toolOutputs, projectId, response.result);
      }
      
      return { result: response.result };
    } else {
      // Default to OpenAI
      const { processOpenAIRequest } = await import("./providers/openAIProvider.ts");
      
      const response = await processOpenAIRequest(
        prompt,
        aiModel,
        supabase,
        promptRunId,
        projectId,
        useMCP,
        contextData
      );
      
      if (useMCP && response.toolOutputs) {
        const processedResponse = await processToolOutputs(supabase, response.toolOutputs, projectId, response.result);
        return {
          ...processedResponse,
          toolOutputs: response.toolOutputs
        };
      }
      
      return { result: response.result };
    }
  } catch (error) {
    console.error("Error handling AI response:", error);
    return { 
      result: `Error: ${error.message || "Unknown error occurred"}` 
    };
  }
}

async function processToolOutputs(
  supabase: any,
  toolOutputs: any[],
  projectId: string,
  finalResult: string
): Promise<{
  result: string;
  actionRecordId?: string;
  reminderSet?: boolean;
  nextCheckDateInfo?: any;
  humanReviewRequestId?: string;
  knowledgeResults?: any[];
}> {
  console.log(`Processing ${toolOutputs.length} tool outputs`);
  
  const result = {
    result: finalResult,
    actionRecordId: undefined,
    reminderSet: false,
    nextCheckDateInfo: undefined,
    humanReviewRequestId: undefined,
    knowledgeResults: []
  };
  
  for (const toolOutput of toolOutputs) {
    const { tool, args, result: toolResult } = toolOutput;
    
    if (tool === "detect_action") {
      console.log(`Detected action decision: ${toolResult.decision}`);
      
      if (toolResult.reminderSet) {
        result.reminderSet = true;
        result.nextCheckDateInfo = {
          days: toolResult.reminderDays,
          reason: args.check_reason || args.reason
        };
      }
    }
    else if (tool === "create_action_record" || tool === "generate_action") {
      console.log(`Action record created: ${JSON.stringify(toolResult)}`);
      result.actionRecordId = toolResult.action_record_id;
    }
    else if (tool === "knowledge_base_lookup") {
      console.log(`Knowledge base results: ${toolResult.results?.length || 0} items`);
      result.knowledgeResults = toolResult.results || [];
    }
  }
  
  return result;
}
