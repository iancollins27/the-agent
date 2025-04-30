
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
        return processToolOutputs(supabase, response.toolOutputs, projectId, response.result, promptRunId);
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
        const processedResponse = await processToolOutputs(supabase, response.toolOutputs, projectId, response.result, promptRunId);
        return {
          ...processedResponse,
          toolOutputs: response.toolOutputs
        };
      }
      
      return { result: response.result };
    }
  } catch (error) {
    console.error("Error handling AI response:", error);
    
    // Try to request human review if there was an error
    try {
      if (projectId && promptRunId) {
        const humanReviewResult = await requestHumanReview(
          supabase,
          projectId, 
          promptRunId,
          "Error during AI processing",
          error.message || "Unknown error occurred during AI processing"
        );
        
        if (humanReviewResult && humanReviewResult.id) {
          return { 
            result: `An error occurred: ${error.message || "Unknown error"}. A human review has been requested.`,
            humanReviewRequestId: humanReviewResult.id
          };
        }
      }
    } catch (reviewError) {
      console.error("Error requesting human review:", reviewError);
    }
    
    return { 
      result: `Error: ${error.message || "Unknown error occurred"}` 
    };
  }
}

async function processToolOutputs(
  supabase: any,
  toolOutputs: any[],
  projectId: string,
  finalResult: string,
  promptRunId: string
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
  
  let errorFound = false;
  let errorMessage = "";
  let detectedDecision = null;
  
  for (const toolOutput of toolOutputs) {
    const { tool, args, result: toolResult } = toolOutput;
    
    // Handle potential null or undefined toolResult
    if (!toolResult) {
      console.error(`Null or undefined result for tool ${tool}`);
      errorFound = true;
      errorMessage += `Failed to get result from ${tool}. `;
      continue;
    }
    
    if (tool === "detect_action") {
      console.log(`Detected action decision: ${toolResult.decision}`);
      detectedDecision = toolResult.decision;
      
      if (toolResult.status === "error") {
        errorFound = true;
        errorMessage += `Error in detect_action: ${toolResult.error}. `;
        continue;
      }
      
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
      
      // Make sure create_action_record has the decision from detect_action
      if (!args.decision && detectedDecision) {
        console.log(`Adding missing decision to action: ${detectedDecision}`);
        // Update the args with the detected decision
        toolOutput.args.decision = detectedDecision;
      }
      
      if (toolResult.status === "error") {
        errorFound = true;
        errorMessage += `Error in create_action_record: ${toolResult.error}. `;
        continue;
      }
      
      result.actionRecordId = toolResult.action_record_id;
    }
    else if (tool === "knowledge_base_lookup") {
      // We're not using this anymore, but keeping the handling just in case
      console.log(`Knowledge base lookup no longer available`);
    }
  }
  
  // If we encountered errors in tool processing, request human review
  if (errorFound && projectId && promptRunId) {
    try {
      const humanReviewResult = await requestHumanReview(
        supabase,
        projectId, 
        promptRunId,
        "Tool execution errors during MCP conversation",
        errorMessage
      );
      
      if (humanReviewResult && humanReviewResult.id) {
        result.humanReviewRequestId = humanReviewResult.id;
        result.result = `A request for human review has been initiated to address the errors encountered while processing the tools: ${errorMessage} Please wait for further updates from the human team managing this project.`;
      }
    } catch (e) {
      console.error("Error requesting human review:", e);
    }
  }
  
  return result;
}
