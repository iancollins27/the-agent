
import { extractJsonFromResponse, generateMockResult } from "../utils.ts";
import { createActionRecord, updatePromptRunWithResult } from "../database/index.ts";
import { callAIProvider, callAIProviderWithMCP } from "../ai-providers.ts";
import { 
  extractToolCallsFromOpenAI, 
  extractToolCallsFromClaude, 
  addToolResult,
  addAssistantMessage,
  createMCPContext,
  MCPContext,
  getDefaultTools
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
  let mcpContext: MCPContext = createMCPContext(systemPrompt, finalPrompt, getDefaultTools());
  
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

// Process the tool calls from MCP and extract results
async function processToolCalls(
  supabase: any,
  toolCalls: any[],
  mcpContext: MCPContext,
  aiProvider: string,
  aiModel: string,
  promptRunId: string | null,
  projectId: string | null,
  contextData: any
) {
  let result = '';
  let actionRecordId = null;
  let reminderSet = false;
  let nextCheckDateInfo = null;
  let humanReviewRequestId = null;
  let knowledgeResults = [];
  
  if (toolCalls.length === 0) {
    // No tool calls, get the assistant's message
    const assistantMessage = mcpContext.messages.find(msg => msg.role === 'assistant');
    result = assistantMessage?.content || 'No action determined by the AI.';
  } else {
    for (const toolCall of toolCalls) {
      if (toolCall.name === 'detect_action') {
        const decision = toolCall.arguments.decision;
        const reason = toolCall.arguments.reason;
        
        // Update context with tool result
        mcpContext = addToolResult(mcpContext, 'detect_action', { success: true, result: 'Action detected' });
        
        // Format result as JSON
        result = JSON.stringify({
          decision,
          reason,
          ...toolCall.arguments
        }, null, 2);
        
        // If action needed, create an action record
        if (decision === 'ACTION_NEEDED' && projectId && promptRunId) {
          try {
            actionRecordId = await createActionRecord(supabase, promptRunId, projectId, toolCall.arguments);
          } catch (error) {
            console.error('Error creating action record:', error);
          }
        } 
        // If future reminder, set it
        else if (decision === 'SET_FUTURE_REMINDER' && projectId) {
          reminderSet = true;
          const daysToAdd = toolCall.arguments.days_until_check || 7;
          
          try {
            const { data: project } = await supabase
              .from('projects')
              .select('next_check_date')
              .eq('id', projectId)
              .single();
              
            const currentValue = project?.next_check_date;
            
            // Calculate and set next check date
            const today = new Date();
            const nextDate = new Date(today);
            nextDate.setDate(today.getDate() + daysToAdd);
            const nextCheckDate = nextDate.toISOString().split('T')[0];
            
            await supabase
              .from('projects')
              .update({ next_check_date: nextCheckDate })
              .eq('id', projectId);
              
            nextCheckDateInfo = {
              currentValue,
              newValue: nextCheckDate
            };
          } catch (error) {
            console.error('Error setting next check date:', error);
          }
        }
      } 
      else if (toolCall.name === 'generate_action') {
        // Similar handling for generate_action tool
        const actionType = toolCall.arguments.action_type;
        
        // Add to result
        const actionResult = {
          action_type: actionType,
          ...toolCall.arguments
        };
        
        result = JSON.stringify(actionResult, null, 2);
        
        // Create action record if needed
        if (projectId && promptRunId) {
          try {
            actionRecordId = await createActionRecord(supabase, promptRunId, projectId, actionResult);
          } catch (error) {
            console.error('Error creating action record:', error);
          }
        }
      }
      else if (toolCall.name === 'knowledge_base_lookup') {
        try {
          const query = toolCall.arguments.query;
          const lookupProjectId = toolCall.arguments.project_id || projectId;
          
          if (lookupProjectId) {
            const results = await queryKnowledgeBase(supabase, query, lookupProjectId);
            knowledgeResults = results;
            
            // Format the results for the AI
            const formattedResults = formatKnowledgeResults(results);
            
            // Add results to the MCP context
            mcpContext = addToolResult(mcpContext, 'knowledge_base_lookup', {
              results: formattedResults
            });
            
            // If we need to make a follow-up call with the new context
            if (results.length > 0) {
              const followUpResponse = await callAIProviderWithMCP(aiProvider, aiModel, mcpContext);
              const followUpMessage = aiProvider === 'openai'
                ? followUpResponse.choices[0]?.message?.content
                : followUpResponse.content[0]?.text;
                
              if (followUpMessage) {
                result = followUpMessage;
              }
            }
          }
        } catch (error) {
          console.error('Error processing knowledge base lookup:', error);
        }
      }
    }
  }
  
  return {
    result,
    actionRecordId,
    reminderSet,
    nextCheckDateInfo,
    humanReviewRequestId,
    knowledgeResults,
    rawResponse: mcpContext
  };
}

