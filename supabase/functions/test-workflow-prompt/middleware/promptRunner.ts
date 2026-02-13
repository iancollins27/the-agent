
import { logPromptRun } from '../database/prompt-runs.ts';
import { handleAIResponse } from '../services/aiResponseHandler.ts';
import { replaceVariables } from '../utils.ts';
import { AI_CONFIG } from '../../_shared/aiConfig.ts';

/**
 * Middleware to run the prompt and process the AI response
 */
export async function runPrompt(
  supabase: any, 
  requestBody: any
): Promise<any> {
  const {
    promptType,
    promptText,
    projectId,
    contextData = {},
    aiProvider = AI_CONFIG.provider,
    aiModel = AI_CONFIG.model,
    workflowPromptId,
    useMCP = false,
    initiatedBy = 'manual'
  } = requestBody;

  // Log the prompt execution
  console.log(`Executing prompt type: ${promptType} for project ${projectId}`);
  console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);
  console.log(`Using MCP: ${useMCP}`);
  console.log(`Initiated by: ${initiatedBy}`);
  
  // Process the variables in the prompt
  let finalPrompt = promptText;
  if (finalPrompt) {
    finalPrompt = replaceVariables(finalPrompt, contextData);
    console.log(`Final prompt after variable replacement: ${finalPrompt.substring(0, 100)}...`);
  }
  
  // Create a prompt run in the database
  let promptRunId;
  try {
    const inputLength = promptText?.length || 0;
    console.log(`Logging prompt run with data:`, {
      project_id: projectId,
      workflow_prompt_id: workflowPromptId,
      prompt_input: promptText?.substring(0, 100) + "...",
      ai_provider: aiProvider,
      ai_model: aiModel,
      input_length: inputLength,
      initiated_by: initiatedBy
    });
    
    promptRunId = await logPromptRun(
      supabase, 
      projectId, 
      workflowPromptId, 
      promptText || "",
      aiProvider,
      aiModel,
      initiatedBy
    );
    
    // Update project with latest prompt run ID
    if (projectId && promptRunId) {
      const { error } = await supabase
        .from('projects')
        .update({ latest_prompt_run_ID: promptRunId })
        .eq('id', projectId);
      
      if (error) {
        console.error('Error updating project with latest_prompt_run_ID:', error);
      } else {
        console.log(`Successfully updated project ${projectId} with latest_prompt_run_ID: ${promptRunId}`);
      }
    }
  } catch (error) {
    console.error('Error logging prompt run:', error);
  }
  
  // Process the AI response
  try {
    const isMCPRequest = useMCP || promptType === 'tool_orchestrator';
    
    const result = await handleAIResponse(
      supabase,
      aiProvider,
      aiModel,
      finalPrompt || "",
      promptRunId || "",
      projectId || "",
      promptType,
      isMCPRequest,
      contextData
    );
    
    return result;
  } catch (error) {
    console.error('Error processing AI response:', error);
    
    // Update the prompt run with the error if we have a promptRunId
    if (promptRunId) {
      try {
        await supabase
          .from('prompt_runs')
          .update({ 
            status: 'ERROR',
            error_message: error.message || 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', promptRunId);
      } catch (updateError) {
        console.error('Error updating prompt run with error status:', updateError);
      }
    }
    
    throw error;
  }
}
