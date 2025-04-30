import { extractJsonFromResponse, generateMockResult } from "../utils.ts";
import { createActionRecord, updatePromptRunWithResult } from "../database/index.ts";
import { callAIProvider, callAIProviderWithMCP, calculateCost } from "../ai-providers.ts";
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
import { logToolCall, updatePromptRunMetrics } from "../database/tool-logs.ts";
import { getLatestWorkflowPrompt } from "../services/workflowPromptService.ts";

const startTimer = () => {
  return Date.now();
};

const endTimer = (startTime: number) => {
  return Date.now() - startTime;
};

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
  let promptTokens = 0;
  let completionTokens = 0;
  let costUSD = 0;

  try {
    console.log(`Handling AI response with MCP: ${useMCP}, provider: ${aiProvider}, model: ${aiModel}`);
    
    if (useMCP && (aiProvider === "openai" || aiProvider === "claude")) {
      ({ result, actionRecordId, reminderSet, nextCheckDateInfo, humanReviewRequestId, knowledgeResults, rawResponse, promptTokens, completionTokens, costUSD } = 
        await handleMCPResponse(supabase, aiProvider, aiModel, finalPrompt, promptRunId, projectId, contextData));
    } else {
      ({ result, actionRecordId, reminderSet, nextCheckDateInfo, promptTokens, completionTokens, costUSD } = 
        await handleStandardResponse(supabase, aiProvider, aiModel, finalPrompt, promptRunId, projectId, promptType, contextData));
    }

    // Update prompt run with metrics
    if (promptRunId) {
      await updatePromptRunWithResult(supabase, promptRunId, result);
      await updatePromptRunMetrics(supabase, promptRunId, {
        promptTokens,
        completionTokens, 
        usdCost: costUSD
      });
    }

    return {
      result,
      actionRecordId,
      reminderSet,
      nextCheckDateInfo,
      humanReviewRequestId,
      knowledgeResults,
      rawResponse,
      usedMCP: useMCP
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
  console.log("Using Model Context Protocol for structured interaction");
  
  const modelToUse = aiProvider === "claude" ? "claude-3-5-haiku-20241022" : aiModel;
  
  // Get the MCP orchestrator prompt from the database
  let systemPrompt = "You are an AI assistant that processes project information and helps determine appropriate actions. Use the available tools to analyze the context and suggest actions.";
  
  try {
    // Fetch the latest MCP orchestrator prompt
    const { getLatestWorkflowPrompt } = await import("../../comms-business-logic/services/workflowPromptService.ts");
    const orchestratorPrompt = await getLatestWorkflowPrompt(supabase, "mcp_orchestrator");
    
    if (orchestratorPrompt && orchestratorPrompt.prompt_text) {
      console.log("Found MCP orchestrator prompt in the database");
      systemPrompt = orchestratorPrompt.prompt_text;
    } else {
      console.log("No MCP orchestrator prompt found, using default");
    }
  } catch (error) {
    console.error("Error fetching MCP orchestrator prompt:", error);
    // Continue with default prompt
  }
  
  // Create MCP context with enhanced system prompt and tools
  console.log("Creating MCP context with tools and orchestrator prompt");
  let mcpContext: MCPContext = createMCPContext(systemPrompt, finalPrompt, getDefaultTools());
  
  // Keep track of original prompt for display in UI
  const originalPrompt = finalPrompt;
  
  // Add workflow context to the MCP context if available
  if (contextData) {
    // Add additional context as a system message for better orchestration
    const contextMessage = {
      role: 'system' as const,
      content: `Current project context:\n${JSON.stringify(contextData, null, 2)}`
    };
    mcpContext.messages.splice(1, 0, contextMessage); // Insert after system prompt, before user message
  }
  
  // Start the timer for performance measurement
  const callStartTime = startTimer();
  
  // Call AI provider with MCP context
  console.log(`Calling ${aiProvider} with MCP context`);
  const rawResponse = await callAIProviderWithMCP(aiProvider, modelToUse, mcpContext);
  
  // End timer and calculate duration
  const callDuration = endTimer(callStartTime);
  console.log(`${aiProvider} API call completed in ${callDuration}ms`);

  // Extract token usage and calculate cost
  let promptTokens = 0;
  let completionTokens = 0;
  let costUSD = 0;
  
  if (aiProvider === "openai" && rawResponse.usage) {
    promptTokens = rawResponse.usage.prompt_tokens || 0;
    completionTokens = rawResponse.usage.completion_tokens || 0;
    costUSD = calculateCost(modelToUse, promptTokens, completionTokens);
  } else if (aiProvider === "claude" && rawResponse.usage) {
    // Claude usage format
    promptTokens = rawResponse.usage.input_tokens || 0;
    completionTokens = rawResponse.usage.output_tokens || 0;
    costUSD = calculateCost(modelToUse, promptTokens, completionTokens);
  }
  
  console.log(`Token usage - Prompt: ${promptTokens}, Completion: ${completionTokens}, Cost: $${costUSD.toFixed(4)}`);
  
  // Extract tool calls from response based on provider
  console.log(`Extracting tool calls from ${aiProvider} response`);
  const toolCalls = aiProvider === "openai" 
    ? extractToolCallsFromOpenAI(rawResponse)
    : extractToolCallsFromClaude(rawResponse);
  
  console.log(`Extracted ${toolCalls.length} tool calls`);
  
  // Process the extracted tool calls
  return await processToolCalls(
    supabase, 
    toolCalls, 
    mcpContext, 
    aiProvider, 
    modelToUse, 
    promptRunId, 
    projectId, 
    contextData,
    originalPrompt,
    promptTokens,
    completionTokens,
    costUSD
  );
}

async function handleStandardResponse(
  supabase: any,
  aiProvider: string,
  aiModel: string,
  finalPrompt: string,
  promptRunId: string | null,
  projectId: string | null,
  promptType: string,
  contextData: any
) {
  console.log(`Using standard prompt-response format with ${aiProvider} model ${aiModel}`);
  
  const callStartTime = startTimer();
  const result = await callAIProvider(aiProvider, aiModel, finalPrompt);
  const callDuration = endTimer(callStartTime);
  
  console.log(`Standard AI call completed in ${callDuration}ms`);
  console.log("Raw AI response:", result);
  
  // Estimate token usage for standard calls
  // This is an approximation since we don't get token counts from the API directly
  const promptTokens = Math.round(finalPrompt.length / 4); // Rough estimate
  const completionTokens = Math.round(result.length / 4);  // Rough estimate
  const costUSD = calculateCost(aiModel, promptTokens, completionTokens);
  
  if (promptType === "action_detection_execution" && projectId) {
    return await processActionDetection(
      supabase, 
      result, 
      promptRunId, 
      projectId, 
      promptTokens, 
      completionTokens, 
      costUSD
    );
  }
  
  return { 
    result, 
    actionRecordId: null, 
    reminderSet: false, 
    nextCheckDateInfo: null,
    promptTokens,
    completionTokens,
    costUSD
  };
}

async function processToolCalls(
  supabase: any,
  toolCalls: any[],
  mcpContext: MCPContext,
  aiProvider: string,
  aiModel: string,
  promptRunId: string | null,
  projectId: string | null,
  contextData: any,
  originalPrompt: string,
  promptTokens: number,
  completionTokens: number,
  costUSD: number
) {
  let result = '';
  let actionRecordId = null;
  let reminderSet = false;
  let nextCheckDateInfo = null;
  let humanReviewRequestId = null;
  let knowledgeResults = [];
  
  if (toolCalls.length === 0) {
    console.log("No tool calls found in the response");
    
    const assistantMessage = mcpContext.messages.find(msg => msg.role === 'assistant');
    result = assistantMessage?.content || 'No action determined by the AI.';
    
    console.log("Using assistant message as result:", result);
  } else {
    console.log(`Processing ${toolCalls.length} tool calls`);
    
    for (const toolCall of toolCalls) {
      console.log(`Processing tool call: ${toolCall.name}`);
      const toolCallStartTime = startTimer();
      
      try {
        if (toolCall.name === 'detect_action') {
          const decision = toolCall.arguments.decision;
          const reason = toolCall.arguments.reason;
          
          console.log(`Action detection decision: ${decision}`);
          console.log(`Reason: ${reason}`);
          
          // Log tool call for metrics
          await logToolCall(supabase, {
            promptRunId: promptRunId || "",
            name: toolCall.name,
            status: 200,
            duration: endTimer(toolCallStartTime),
            args: toolCall.arguments,
            output: JSON.stringify({ success: true, decision, reason })
          });
          
          mcpContext = addToolResult(mcpContext, 'detect_action', { success: true, result: 'Action detected' });
          
          result = JSON.stringify({
            decision,
            reason,
            ...toolCall.arguments
          }, null, 2);
          
          if (decision === 'ACTION_NEEDED' && projectId && promptRunId) {
            try {
              console.log("Creating action record");
              actionRecordId = await createActionRecord(supabase, promptRunId, projectId, toolCall.arguments);
              console.log(`Action record created: ${actionRecordId}`);
            } catch (error) {
              console.error('Error creating action record:', error);
            }
          } 
          else if (decision === 'SET_FUTURE_REMINDER' && projectId) {
            reminderSet = true;
            const daysToAdd = toolCall.arguments.days_until_check || 7;
            
            try {
              console.log(`Setting next check date to ${daysToAdd} days from now`);
              
              const { data: project } = await supabase
                .from('projects')
                .select('next_check_date')
                .eq('id', projectId)
                .single();
                
              const currentValue = project?.next_check_date;
              
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
              
              console.log(`Next check date set to ${nextCheckDate}`);
            } catch (error) {
              console.error('Error setting next check date:', error);
            }
          }
        } 
        else if (toolCall.name === 'generate_action') {
          const actionType = toolCall.arguments.action_type;
          console.log(`Generating action of type: ${actionType}`);
          
          // Log tool call for metrics
          await logToolCall(supabase, {
            promptRunId: promptRunId || "",
            name: toolCall.name,
            status: 200,
            duration: endTimer(toolCallStartTime),
            args: toolCall.arguments,
            output: JSON.stringify({ success: true, actionType })
          });
          
          const actionResult = {
            action_type: actionType,
            ...toolCall.arguments
          };
          
          result = JSON.stringify(actionResult, null, 2);
          
          if (projectId && promptRunId) {
            try {
              console.log("Creating action record from generate_action");
              actionRecordId = await createActionRecord(supabase, promptRunId, projectId, actionResult);
              console.log(`Action record created: ${actionRecordId}`);
            } catch (error) {
              console.error('Error creating action record:', error);
            }
          }
        }
        else if (toolCall.name === 'knowledge_base_lookup') {
          try {
            console.log("Processing knowledge base lookup");
            const query = toolCall.arguments.query;
            const lookupProjectId = toolCall.arguments.project_id || projectId;
            
            console.log(`Query: "${query}" for project: ${lookupProjectId}`);
            
            if (lookupProjectId) {
              const queryStartTime = startTimer();
              const results = await queryKnowledgeBase(supabase, query, lookupProjectId);
              const queryDuration = endTimer(queryStartTime);
              
              // Log tool call for metrics
              await logToolCall(supabase, {
                promptRunId: promptRunId || "",
                name: toolCall.name,
                status: 200,
                duration: queryDuration,
                args: toolCall.arguments,
                output: JSON.stringify({ count: results.length })
              });
              
              knowledgeResults = results;
              console.log(`Found ${results.length} knowledge base results`);
              
              const formattedResults = formatKnowledgeResults(results);
              
              mcpContext = addToolResult(mcpContext, 'knowledge_base_lookup', {
                results: formattedResults
              });
              
              if (results.length > 0) {
                console.log("Calling AI again with knowledge base results");
                const followUpResponse = await callAIProviderWithMCP(aiProvider, aiModel, mcpContext);
                const followUpMessage = aiProvider === 'openai'
                  ? followUpResponse.choices[0]?.message?.content
                  : followUpResponse.content[0]?.text;
                  
                if (followUpMessage) {
                  result = followUpMessage;
                  console.log("Updated result with knowledge-enhanced response");
                }
              }
            }
          } catch (error) {
            console.error('Error processing knowledge base lookup:', error);
            await logToolCall(supabase, {
              promptRunId: promptRunId || "",
              name: toolCall.name,
              status: 500,
              duration: endTimer(toolCallStartTime),
              args: toolCall.arguments,
              output: JSON.stringify({ error: error.message })
            });
          }
        }
      } catch (toolError) {
        console.error(`Error processing tool call ${toolCall.name}:`, toolError);
        await logToolCall(supabase, {
          promptRunId: promptRunId || "",
          name: toolCall.name,
          status: 500,
          duration: endTimer(toolCallStartTime),
          args: toolCall.arguments || {},
          output: JSON.stringify({ error: toolError.message })
        });
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
    rawResponse: mcpContext,
    originalPrompt,
    promptTokens,
    completionTokens,
    costUSD
  };
}

async function processActionDetection(
  supabase: any,
  result: string,
  promptRunId: string | null,
  projectId: string | null,
  promptTokens: number,
  completionTokens: number,
  costUSD: number
) {
  console.log("Processing standard action detection result");
  
  try {
    // Try to parse the JSON response
    const parsedResult = extractJsonFromResponse(result);
    console.log("Parsed result:", parsedResult);
    
    let actionRecordId = null;
    let reminderSet = false;
    let nextCheckDateInfo = null;
    
    if (parsedResult && parsedResult.decision === "ACTION_NEEDED" && projectId && promptRunId) {
      try {
        console.log("Creating action record from standard response");
        actionRecordId = await createActionRecord(supabase, promptRunId, projectId, parsedResult);
        console.log(`Action record created: ${actionRecordId}`);
      } catch (error) {
        console.error('Error creating action record:', error);
      }
    } 
    else if (parsedResult && parsedResult.decision === "SET_FUTURE_REMINDER" && projectId) {
      reminderSet = true;
      const daysToAdd = parsedResult.days_until_check || 7;
      
      try {
        console.log(`Setting next check date to ${daysToAdd} days from now`);
        
        const { data: project } = await supabase
          .from('projects')
          .select('next_check_date')
          .eq('id', projectId)
          .single();
          
        const currentValue = project?.next_check_date;
        
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
        
        console.log(`Next check date set to ${nextCheckDate}`);
      } catch (error) {
        console.error('Error setting next check date:', error);
      }
    }
    
    return { 
      result, 
      actionRecordId, 
      reminderSet, 
      nextCheckDateInfo,
      promptTokens,
      completionTokens,
      costUSD
    };
  } catch (error) {
    console.error('Error processing action detection result:', error);
    return { 
      result, 
      actionRecordId: null, 
      reminderSet: false, 
      nextCheckDateInfo: null,
      promptTokens,
      completionTokens,
      costUSD
    };
  }
}
