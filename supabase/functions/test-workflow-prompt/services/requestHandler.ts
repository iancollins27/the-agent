
import { corsHeaders } from "../index.ts";
import { logPromptRun } from "../database/index.ts";
import { replaceVariables } from "../utils.ts";
import { handleAIResponse } from "./aiResponseHandler.ts";

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
  
  if (!promptText) {
    throw new Error("Prompt text is required");
  }
  
  let finalPrompt = replaceVariables(promptText, contextData);
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
  
  return new Response(
    JSON.stringify({
      output: response.result,
      finalPrompt,
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
      knowledgeResults: response.knowledgeResults?.length || 0
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 200,
    }
  );
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
