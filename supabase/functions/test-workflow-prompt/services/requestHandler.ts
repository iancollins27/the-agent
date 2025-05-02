
import { corsHeaders } from "../utils/cors.ts";
import { logPromptRun } from "../database/index.ts";
import { replaceVariables } from "../utils.ts";
import { handleAIResponse } from "./aiResponseHandler.ts";
import { getMilestoneInstructions } from "../database/milestone.ts";
import { getLatestWorkflowPrompt } from "../database/workflow-prompts.ts";

export async function handleRequest(supabase: any, requestBody: any) {
  const { 
    promptType, 
    promptText, 
    projectId, 
    contextData, 
    aiProvider, 
    aiModel, 
    workflowPromptId,
    useMCP = false 
  } = requestBody;
  
  console.log(`Testing prompt type: ${promptType} for project ${projectId}`);
  console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);
  console.log(`Using MCP: ${useMCP}`);
  
  if (requestBody.initiatedBy) {
    console.log(`Initiated by: ${requestBody.initiatedBy}`);
  }

  // For MCP orchestrator prompts, always get the latest prompt from database
  let finalPromptText = promptText;
  if (promptType === 'mcp_orchestrator' && !finalPromptText) {
    try {
      const mcpPrompt = await getLatestWorkflowPrompt(supabase, 'mcp_orchestrator');
      if (mcpPrompt && mcpPrompt.prompt_text) {
        console.log("Using MCP orchestrator prompt from database instead of provided prompt");
        finalPromptText = mcpPrompt.prompt_text;
      } else {
        console.warn("No MCP orchestrator prompt found in database");
      }
    } catch (err) {
      console.error("Error fetching MCP orchestrator prompt:", err);
    }
  }
  
  if (!finalPromptText) {
    throw new Error("Prompt text is required");
  }

  // Fetch milestone instructions if needed for the project
  let milestoneInstructions = null;
  if (projectId && contextData.next_step) {
    try {
      const projectTrackId = contextData.track_id || null;
      milestoneInstructions = await getMilestoneInstructions(supabase, contextData.next_step, projectTrackId);
      
      if (milestoneInstructions) {
        console.log(`Found milestone instructions for step "${contextData.next_step}". Length: ${milestoneInstructions.length} chars`);
        // Add milestone instructions to context data
        contextData.milestone_instructions = milestoneInstructions;
      } else {
        console.log(`No milestone instructions found for step "${contextData.next_step}"`);
        contextData.milestone_instructions = "No specific instructions available for this milestone.";
      }
    } catch (milestoneError) {
      console.error("Error fetching milestone instructions:", milestoneError);
      contextData.milestone_instructions = "Error retrieving milestone instructions.";
    }
  }
  
  // Ensure default values for variables that might be missing
  contextData.is_reminder_check = contextData.is_reminder_check || false;
  contextData.available_tools = contextData.available_tools || [];
  
  // Perform the variable replacement
  let finalPrompt = replaceVariables(finalPromptText, contextData);
  console.log("Final prompt after variable replacement:", finalPrompt);
  
  let promptRunId = null;
  
  try {
    promptRunId = await logPromptRun(
      supabase, 
      projectId, 
      workflowPromptId, 
      finalPrompt, 
      aiProvider, 
      aiModel
    );
    
    if (promptType === "action_detection_execution" && projectId && promptRunId) {
      await updateProjectLatestPromptRun(supabase, projectId, promptRunId);
    }
  } catch (err) {
    console.error("Error creating prompt run:", err);
  }
  
  const response = await handleAIResponse(
    supabase,
    aiProvider,
    aiModel,
    finalPrompt,
    promptRunId,
    projectId,
    promptType,
    useMCP,
    contextData
  );
  
  return {
    output: response.result,
    // If using MCP, we'll mark the prompt text differently
    finalPrompt: useMCP ? "[Using Model Context Protocol - see results for details]" : finalPrompt,
    projectId,
    promptType,
    aiProvider,
    aiModel,
    promptRunId,
    actionRecordId: response.actionRecordId,
    reminderSet: response.reminderSet,
    nextCheckDateInfo: response.nextCheckDateInfo,
    usedMCP: useMCP,
    humanReviewRequestId: response.humanReviewRequestId,
    knowledgeResults: response.knowledgeResults || [],
    toolOutputs: response.toolOutputs || [],
    // We'll include the original prompt for reference but not for display
    originalPrompt: useMCP ? finalPrompt : null
  };
}

async function updateProjectLatestPromptRun(supabase: any, projectId: string, promptRunId: string) {
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
