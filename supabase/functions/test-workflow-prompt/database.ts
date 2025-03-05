
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Logs a new prompt run in the database
 */
export async function logPromptRun(
  supabase: SupabaseClient,
  projectId: string | null, 
  workflowPromptId: string | null, 
  promptInput: string,
  aiProvider: string,
  aiModel: string
) {
  try {
    const { data, error } = await supabase
      .from('prompt_runs')
      .insert({
        project_id: projectId,
        workflow_prompt_id: workflowPromptId,
        prompt_input: promptInput,
        status: 'PENDING',
        ai_provider: aiProvider,
        ai_model: aiModel
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error logging prompt run:", error);
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error("Error logging prompt run:", error);
    return null;
  }
}

/**
 * Updates a prompt run with the result
 */
export async function updatePromptRunWithResult(
  supabase: SupabaseClient,
  promptRunId: string, 
  result: string, 
  isError: boolean = false
) {
  if (!promptRunId) return;
  
  try {
    const updateData: any = {
      status: isError ? 'ERROR' : 'COMPLETED',
      completed_at: new Date().toISOString()
    };
    
    if (isError) {
      updateData.error_message = result;
    } else {
      updateData.prompt_output = result;
    }
    
    const { error } = await supabase
      .from('prompt_runs')
      .update(updateData)
      .eq('id', promptRunId);
      
    if (error) {
      console.error("Error updating prompt run:", error);
    }
  } catch (error) {
    console.error("Error updating prompt run:", error);
  }
}

/**
 * Creates an action record from action detection+execution results
 */
export async function createActionRecord(
  supabase: SupabaseClient,
  promptRunId: string, 
  projectId: string, 
  actionData: any
) {
  try {
    // Parse the decision and other data from the AI response
    const decision = actionData.decision;
    
    // Only create an action record if the decision is ACTION_NEEDED
    if (decision === "ACTION_NEEDED") {
      // Extract action type from response or default to message
      const actionType = actionData.action_type || "message";
      
      // Extract requires_approval flag or default to true for safety
      const requiresApproval = actionData.requires_approval !== undefined 
        ? actionData.requires_approval 
        : true;
      
      // Use provided action_payload or build a default one
      const actionPayload = actionData.action_payload || {
        message_text: actionData.message_text,
        reason: actionData.reason
      };
      
      console.log("Creating action record with data:", {
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: actionType,
        action_payload: actionPayload,
        requires_approval: requiresApproval
      });
      
      const { data, error } = await supabase
        .from('action_records')
        .insert({
          prompt_run_id: promptRunId,
          project_id: projectId,
          action_type: actionType,
          action_payload: actionPayload,
          requires_approval: requiresApproval,
          status: 'pending'
        })
        .select()
        .single();
        
      if (error) {
        console.error("Error creating action record:", error);
        return null;
      }
      
      console.log("Action record created successfully:", data);
      return data.id;
    } else {
      console.log("No action needed based on AI decision:", decision);
      return null;
    }
  } catch (error) {
    console.error("Error creating action record:", error);
    return null;
  }
}
