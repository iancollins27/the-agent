
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { callAIProvider, callAIProviderWithMCP } from "./ai-providers.ts";
import { 
  logPromptRun, 
  updatePromptRunWithResult, 
  createActionRecord, 
  setNextCheckDate 
} from "./database/index.ts";
import { 
  replaceVariables, 
  generateMockResult, 
  extractJsonFromResponse 
} from "./utils.ts";
import { 
  createMCPContext, 
  getDefaultTools, 
  addToolResult, 
  addAssistantMessage,
  extractToolCallsFromOpenAI,
  extractToolCallsFromClaude
} from "./mcp.ts";
import { 
  queryKnowledgeBase, 
  formatKnowledgeResults 
} from "./knowledge-service.ts";
import {
  createHumanReviewRequest,
  evaluateNeedForHumanReview
} from "./human-service.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("Received request with body:", JSON.stringify(requestBody, null, 2).substring(0, 500) + "...");
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      throw new Error("Invalid JSON in request body");
    }
    
    const { 
      promptType, 
      promptText, 
      projectId, 
      contextData, 
      aiProvider, 
      aiModel, 
      workflowPromptId,
      useMCP = false // New flag to determine whether to use MCP or legacy approach
    } = requestBody;
    
    console.log(`Testing prompt type: ${promptType} for project ${projectId}`);
    console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);
    console.log(`Using MCP: ${useMCP}`);
    
    if (requestBody.initiatedBy) {
      console.log(`Initiated by: ${requestBody.initiatedBy}`);
    }
    
    console.log("Context data provided:", contextData);
    
    if (!promptText) {
      throw new Error("Prompt text is required");
    }
    
    let finalPrompt = replaceVariables(promptText, contextData);
    console.log("Final prompt after variable replacement:", finalPrompt);
    
    let promptRunId = null;
    
    try {
      if (!projectId) {
        console.warn("Warning: projectId is missing, prompt run may not be logged correctly");
      }
      
      promptRunId = await logPromptRun(
        supabase, 
        projectId, 
        workflowPromptId, 
        finalPrompt, 
        aiProvider, 
        aiModel
      );
      
      console.log("Created prompt run with ID:", promptRunId || "Failed to create prompt run");
      
      // Update the latest_prompt_run_ID field on the project if this is an action detection prompt
      if (promptType === "action_detection_execution" && projectId && promptRunId) {
        try {
          const { error: updateError } = await supabase
            .from('projects')
            .update({ latest_prompt_run_ID: promptRunId })
            .eq('id', projectId);
            
          if (updateError) {
            console.error("Error updating project with latest_prompt_run_ID:", updateError);
          } else {
            console.log(`Successfully updated project ${projectId} with latest_prompt_run_ID: ${promptRunId}`);
          }
        } catch (updateProjectError) {
          console.error("Exception updating project latest_prompt_run_ID:", updateProjectError);
        }
      }
    } catch (promptRunError) {
      console.error("Error creating prompt run:", promptRunError);
    }
    
    let result: string;
    let rawResponse: any = null;
    let actionRecordId: string | null = null;
    let reminderSet: boolean = false;
    let nextCheckDateInfo = null;
    let humanReviewRequestId: string | null = null;
    let knowledgeResults: any[] = [];
    
    try {
      // Process differently based on whether we're using MCP or not
      if (useMCP && (aiProvider === "openai" || aiProvider === "claude")) {
        // Create initial MCP context
        const systemPrompt = "You are an AI assistant that processes project information and helps determine appropriate actions. Use the available tools to analyze the context and suggest actions.";
        let mcpContext = createMCPContext(systemPrompt, finalPrompt, getDefaultTools());
        
        // Call AI with MCP format
        rawResponse = await callAIProviderWithMCP(aiProvider, aiModel, mcpContext);
        
        // Extract tool calls based on provider
        const toolCalls = aiProvider === "openai" 
          ? extractToolCallsFromOpenAI(rawResponse)
          : extractToolCallsFromClaude(rawResponse);
        
        // Process each tool call
        for (const toolCall of toolCalls) {
          if (toolCall.name === "detect_action") {
            const actionData = toolCall.arguments;
            
            // Log the detected action
            console.log("Detected action:", actionData);
            
            // Handle action based on decision
            if (actionData.decision === "ACTION_NEEDED" && projectId) {
              try {
                actionRecordId = await createActionRecord(supabase, promptRunId || "", projectId, actionData);
                console.log("Created action record:", actionRecordId);
              } catch (actionError) {
                console.error("Error creating action record:", actionError);
              }
            } else if (actionData.decision === "SET_FUTURE_REMINDER" && projectId) {
              const daysToAdd = actionData.days_until_check || 7;
              const nextCheckDate = new Date();
              nextCheckDate.setDate(nextCheckDate.getDate() + daysToAdd);
              
              try {
                nextCheckDateInfo = await setNextCheckDate(supabase, projectId, nextCheckDate.toISOString());
                reminderSet = true;
                console.log(`Set reminder for project ${projectId} in ${daysToAdd} days: ${nextCheckDate.toISOString()}`);
                
                actionRecordId = await createActionRecord(supabase, promptRunId || "", projectId, {
                  ...actionData,
                  action_type: "set_future_reminder"
                });
              } catch (reminderError) {
                console.error("Error setting reminder:", reminderError);
              }
            } else if (actionData.decision === "QUERY_KNOWLEDGE_BASE" && projectId) {
              try {
                knowledgeResults = await queryKnowledgeBase(
                  supabase,
                  actionData.query || contextData.summary,
                  projectId
                );
                
                // Add knowledge results to context
                const formattedKnowledge = formatKnowledgeResults(knowledgeResults);
                mcpContext = addToolResult(mcpContext, "knowledge_base_lookup", {
                  results: knowledgeResults
                });
                
                // Make another call to get final action with knowledge included
                mcpContext = addAssistantMessage(mcpContext, 
                  "I've queried the knowledge base. Let me analyze this information and determine the appropriate action."
                );
                
                const knowledgeResponse = await callAIProviderWithMCP(aiProvider, aiModel, mcpContext);
                const knowledgeToolCalls = aiProvider === "openai" 
                  ? extractToolCallsFromOpenAI(knowledgeResponse)
                  : extractToolCallsFromClaude(knowledgeResponse);
                
                for (const ktoolCall of knowledgeToolCalls) {
                  if (ktoolCall.name === "detect_action") {
                    const kactionData = ktoolCall.arguments;
                    console.log("Knowledge-informed action:", kactionData);
                    
                    if (kactionData.decision === "ACTION_NEEDED" && projectId) {
                      actionRecordId = await createActionRecord(supabase, promptRunId || "", projectId, kactionData);
                    } else if (kactionData.decision === "SET_FUTURE_REMINDER" && projectId) {
                      const kdaysToAdd = kactionData.days_until_check || 7;
                      const knextCheckDate = new Date();
                      knextCheckDate.setDate(knextCheckDate.getDate() + kdaysToAdd);
                      
                      nextCheckDateInfo = await setNextCheckDate(supabase, projectId, knextCheckDate.toISOString());
                      reminderSet = true;
                      
                      actionRecordId = await createActionRecord(supabase, promptRunId || "", projectId, {
                        ...kactionData,
                        action_type: "set_future_reminder"
                      });
                    }
                  }
                }
              } catch (knowledgeError) {
                console.error("Error in knowledge base query:", knowledgeError);
              }
            } else if (actionData.decision === "REQUEST_HUMAN_REVIEW" && projectId) {
              try {
                const humanReviewData = await createHumanReviewRequest(
                  supabase,
                  projectId,
                  promptRunId || "",
                  {
                    reason: actionData.reason,
                    requested_by: requestBody.initiatedBy || "system",
                    context: contextData.summary,
                    suggested_actions: actionData.suggested_actions || []
                  }
                );
                
                humanReviewRequestId = humanReviewData.id;
                console.log("Created human review request:", humanReviewRequestId);
              } catch (reviewError) {
                console.error("Error creating human review request:", reviewError);
              }
            }
          } else if (toolCall.name === "knowledge_base_lookup") {
            try {
              knowledgeResults = await queryKnowledgeBase(
                supabase,
                toolCall.arguments.query,
                projectId || ""
              );
              
              mcpContext = addToolResult(mcpContext, "knowledge_base_lookup", {
                results: knowledgeResults
              });
            } catch (kbError) {
              console.error("Error in knowledge base lookup tool:", kbError);
            }
          }
        }
        
        // Format a textual result from the structured response
        result = JSON.stringify({
          actionData: toolCalls.length > 0 ? toolCalls[0].arguments : { decision: "NO_ACTION" },
          knowledgeResults: knowledgeResults.length > 0 ? knowledgeResults : []
        }, null, 2);
      } else {
        // Legacy approach
        result = await callAIProvider(aiProvider, aiModel, finalPrompt);
        console.log("Raw AI response:", result);
        
        if (promptType === "action_detection_execution" && projectId) {
          try {
            console.log("Checking for action data in result");
            const actionData = extractJsonFromResponse(result);
            console.log("Parsed action data:", actionData ? JSON.stringify(actionData, null, 2) : "No action data found");
            
            if (actionData) {
              if (actionData.decision === "ACTION_NEEDED") {
                try {
                  actionRecordId = await createActionRecord(supabase, promptRunId || "", projectId, actionData);
                  console.log("Created action record:", actionRecordId || "Failed to create action record");
                } catch (createActionError) {
                  console.error("Error creating action record:", createActionError);
                }
              } else if (actionData.decision === "SET_FUTURE_REMINDER") {
                const daysToAdd = actionData.days_until_check || 7;
                const nextCheckDate = new Date();
                nextCheckDate.setDate(nextCheckDate.getDate() + daysToAdd);
                
                try {
                  nextCheckDateInfo = await setNextCheckDate(supabase, projectId, nextCheckDate.toISOString());
                  reminderSet = true;
                  console.log(`Set reminder for project ${projectId} in ${daysToAdd} days: ${nextCheckDate.toISOString()}`);
                } catch (setDateError) {
                  console.error("Error setting next check date:", setDateError);
                }
                
                try {
                  actionRecordId = await createActionRecord(supabase, promptRunId || "", projectId, {
                    ...actionData,
                    action_type: "set_future_reminder"
                  });
                  console.log("Created reminder action record:", actionRecordId || "Failed to create action record");
                } catch (createActionError) {
                  console.error("Error creating reminder action record:", createActionError);
                }
              } else {
                console.log("No action needed based on decision:", actionData.decision);
              }
            } else {
              console.log("No action data found or invalid format");
            }
          } catch (parseError) {
            console.error("Error parsing or processing action data:", parseError);
          }
        }
      }
      
      if (promptRunId) {
        try {
          await updatePromptRunWithResult(supabase, promptRunId, result);
          console.log("Updated prompt run with result");
        } catch (updateError) {
          console.error("Error updating prompt run:", updateError);
        }
      }
    } catch (error) {
      console.error(`Error calling AI provider (${aiProvider}):`, error);
      result = generateMockResult(promptType, contextData);
      result += `\n\nNote: There was an error using the ${aiProvider} API: ${error.message}`;
      
      if (promptRunId) {
        try {
          await updatePromptRunWithResult(supabase, promptRunId, error.message, true);
        } catch (updateError) {
          console.error("Error updating prompt run with error:", updateError);
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        output: result,
        finalPrompt,
        projectId,
        promptType,
        aiProvider,
        aiModel,
        promptRunId,
        actionRecordId,
        reminderSet,
        nextCheckDateInfo,
        usedMCP: useMCP,
        humanReviewRequestId,
        knowledgeResults: knowledgeResults.length
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in test-workflow-prompt function:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});
