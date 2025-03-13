
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { callAIProvider } from "./ai-providers.ts";
import { logPromptRun, updatePromptRunWithResult, createActionRecord } from "./database.ts";
import { replaceVariables, generateMockResult, extractJsonFromResponse } from "./utils.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { promptType, promptText, projectId, contextData, aiProvider, aiModel, workflowPromptId, initiatedBy } = await req.json();
    
    console.log(`Testing prompt type: ${promptType} for project ${projectId}`);
    console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);
    console.log(`Initiated by: ${initiatedBy || 'System'}`);
    console.log("Context data provided:", contextData);
    
    if (!promptText) {
      throw new Error("Prompt text is required");
    }
    
    // Replace variables in the prompt text with actual values
    const finalPrompt = replaceVariables(promptText, contextData);
    console.log("Final prompt after variable replacement:", finalPrompt);
    
    // Log the prompt run with AI provider and model information
    try {
      // Validate required fields for prompt_runs table
      if (!projectId) {
        console.warn("Warning: projectId is missing, prompt run may not be logged correctly");
      }
      
      const promptRunData = {
        project_id: projectId || null,
        workflow_prompt_id: workflowPromptId || null,
        prompt_input: finalPrompt,
        status: 'PENDING',
        ai_provider: aiProvider,
        ai_model: aiModel,
        initiated_by: initiatedBy || null
      };
      
      console.log("Creating prompt run with data:", promptRunData);
      const promptRunId = await logPromptRun(supabase, projectId, workflowPromptId, finalPrompt, aiProvider, aiModel, initiatedBy);
      console.log("Created prompt run with ID:", promptRunId || "Failed to create prompt run");
      
      let result: string;
      let actionRecordId: string | null = null;
      
      try {
        // Call the appropriate AI provider
        result = await callAIProvider(aiProvider, aiModel, finalPrompt);
        console.log("Raw AI response:", result);
        
        // Update the prompt run with the result
        if (promptRunId) {
          await updatePromptRunWithResult(supabase, promptRunId, result);
          console.log("Updated prompt run with result");
        } else {
          console.warn("Could not update prompt run with result because promptRunId is null");
        }
        
        // For action detection+execution prompt, create an action record if applicable
        if (promptType === "action_detection_execution" && promptRunId && projectId) {
          try {
            console.log("Checking for action data in result");
            // Try to parse the result as JSON using our improved extractor
            const actionData = extractJsonFromResponse(result);
            console.log("Parsed action data:", actionData ? JSON.stringify(actionData, null, 2) : "No action data found");
            
            if (actionData) {
              if (actionData.decision === "ACTION_NEEDED" || actionData.decision === "SET_FUTURE_REMINDER") {
                actionRecordId = await createActionRecord(supabase, promptRunId, projectId, actionData);
                console.log("Created action record:", actionRecordId || "Failed to create action record");
              } else {
                console.log("No action needed based on decision:", actionData.decision);
              }
            } else {
              console.log("No action data found or invalid format");
            }
          } catch (parseError) {
            console.error("Error parsing or processing action data:", parseError);
            // If parsing fails, we don't create an action record
          }
        }
      } catch (error) {
        console.error(`Error calling AI provider (${aiProvider}):`, error);
        // Fall back to mock results if there's an error
        result = generateMockResult(promptType, contextData);
        result += `\n\nNote: There was an error using the ${aiProvider} API: ${error.message}`;
        
        // Update the prompt run with the error
        if (promptRunId) {
          await updatePromptRunWithResult(supabase, promptRunId, error.message, true);
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
          initiatedBy
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 200,
        }
      );
    } catch (innerError) {
      console.error("Error in prompt run operation:", innerError);
      throw innerError; // Re-throw to be caught by outer catch block
    }
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
