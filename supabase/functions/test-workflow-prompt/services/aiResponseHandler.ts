
import { extractJsonFromResponse, generateMockResult } from "../utils.ts";
import { createActionRecord, updatePromptRunWithResult } from "../database/index.ts";
import { callAIProvider, callAIProviderWithMCP } from "../ai-providers.ts";
import { 
  extractToolCallsFromOpenAI, 
  extractToolCallsFromClaude, 
  addToolResult,
  addAssistantMessage 
} from "../mcp.ts";
import { queryKnowledgeBase, formatKnowledgeResults } from "../knowledge-service.ts";
import { createHumanReviewRequest } from "../human-service.ts";

export async function handleAIResponse(
  supabase: any,
  aiProvider: string,
  aiModel: string,
  finalPrompt: string,
  promptRunId: string | null,
  projectId: string | null,
  promptType: string,
  useMCP: boolean,
  contextData: any
) {
  let result: string;
  let actionRecordId: string | null = null;
  let reminderSet = false;
  let nextCheckDateInfo = null;
  let humanReviewRequestId: string | null = null;
  let knowledgeResults: any[] = [];
  let rawResponse: any = null;

  try {
    if (useMCP && (aiProvider === "openai" || aiProvider === "claude")) {
      ({ result, actionRecordId, reminderSet, nextCheckDateInfo, humanReviewRequestId, knowledgeResults, rawResponse } = 
        await handleMCPResponse(supabase, aiProvider, aiModel, finalPrompt, promptRunId, projectId, contextData));
    } else {
      ({ result, actionRecordId, reminderSet, nextCheckDateInfo } = 
        await handleStandardResponse(supabase, aiProvider, aiModel, finalPrompt, promptRunId, projectId, promptType));
    }

    if (promptRunId) {
      await updatePromptRunWithResult(supabase, promptRunId, result);
    }

    return {
      result,
      actionRecordId,
      reminderSet,
      nextCheckDateInfo,
      humanReviewRequestId,
      knowledgeResults,
      rawResponse
    };
  } catch (error) {
    console.error(`Error in AI response handler:`, error);
    result = generateMockResult(promptType, contextData);
    result += `\n\nNote: There was an error using the ${aiProvider} API: ${error.message}`;
    
    if (promptRunId) {
      await updatePromptRunWithResult(supabase, promptRunId, error.message, true);
    }

    return { result, error: true };
  }
}

async function handleMCPResponse(
  supabase: any,
  aiProvider: string,
  aiModel: string,
  finalPrompt: string,
  promptRunId: string | null,
  projectId: string | null,
  contextData: any
) {
  const systemPrompt = "You are an AI assistant that processes project information and helps determine appropriate actions. Use the available tools to analyze the context and suggest actions.";
  let mcpContext = createMCPContext(systemPrompt, finalPrompt, getDefaultTools());
  
  const rawResponse = await callAIProviderWithMCP(aiProvider, aiModel, mcpContext);
  
  const toolCalls = aiProvider === "openai" 
    ? extractToolCallsFromOpenAI(rawResponse)
    : extractToolCallsFromClaude(rawResponse);
  
  return await processToolCalls(supabase, toolCalls, mcpContext, aiProvider, aiModel, promptRunId, projectId, contextData);
}

async function handleStandardResponse(
  supabase: any,
  aiProvider: string,
  aiModel: string,
  finalPrompt: string,
  promptRunId: string | null,
  projectId: string | null,
  promptType: string
) {
  const result = await callAIProvider(aiProvider, aiModel, finalPrompt);
  console.log("Raw AI response:", result);
  
  if (promptType === "action_detection_execution" && projectId) {
    return await processActionDetection(supabase, result, promptRunId, projectId);
  }
  
  return { result };
}

// ... Additional helper functions would go here

