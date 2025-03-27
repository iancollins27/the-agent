
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
  aiModel: string,
  initiatedBy: string | null = null
) {
  try {
    console.log("Logging prompt run with data:", {
      project_id: projectId,
      workflow_prompt_id: workflowPromptId,
      prompt_input: promptInput.substring(0, 100) + "...", // Log just the beginning for brevity
      ai_provider: aiProvider,
      ai_model: aiModel,
      initiated_by: initiatedBy
    });

    // Create base insert object
    const insertData: any = {
      project_id: projectId,
      workflow_prompt_id: workflowPromptId,
      prompt_input: promptInput,
      status: 'PENDING',
      ai_provider: aiProvider,
      ai_model: aiModel,
    };

    // Add initiated_by if provided
    if (initiatedBy) {
      insertData.initiated_by = initiatedBy;
    }

    // Insert the prompt run record
    const { data, error } = await supabase
      .from('prompt_runs')
      .insert(insertData)
      .select()
      .single();
      
    if (error) {
      console.error("Error logging prompt run:", error);
      throw new Error(`Failed to log prompt run: ${error.message}`);
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
  if (!promptRunId) {
    console.log("Cannot update prompt run: promptRunId is null");
    return;
  }
  
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
      throw new Error(`Failed to update prompt run: ${error.message}`);
    } else {
      console.log("Successfully updated prompt run with ID:", promptRunId);
    }
  } catch (error) {
    console.error("Error updating prompt run:", error);
  }
}
