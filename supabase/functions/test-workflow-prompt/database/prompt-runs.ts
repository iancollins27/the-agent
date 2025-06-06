
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export async function logPromptRun(
  supabase: SupabaseClient,
  projectId: string | null, 
  workflowPromptId: string | null, 
  promptInput: string,
  aiProvider: string,
  aiModel: string,
  initiatedBy: string = 'manual' // Added initiatedBy parameter with default value
) {
  try {
    // Ensure promptInput is not empty or undefined
    if (!promptInput || typeof promptInput !== 'string' || promptInput.trim() === '') {
      console.error("ERROR: Empty prompt input detected");
      throw new Error("Empty prompt input provided. Cannot log prompt run with empty input.");
    }

    console.log("Logging prompt run with data:", {
      project_id: projectId,
      workflow_prompt_id: workflowPromptId,
      prompt_input: promptInput.substring(0, 100) + "...", // Log just the beginning for brevity
      ai_provider: aiProvider,
      ai_model: aiModel,
      input_length: promptInput.length,
      initiated_by: initiatedBy,
    });

    // Create base insert object
    const insertData: any = {
      project_id: projectId,
      workflow_prompt_id: workflowPromptId,
      prompt_input: promptInput,
      status: 'PENDING',
      ai_provider: aiProvider,
      ai_model: aiModel,
      // Add initiated_by metadata in future column if needed
    };

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
    
    console.log(`Successfully created prompt run record with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error("Error logging prompt run:", error);
    throw error; // Re-throw to let caller handle it
  }
}

export async function updatePromptRunWithResult(
  supabase: SupabaseClient,
  promptRunId: string,
  result: string,
  isError: boolean = false
) {
  try {
    if (!promptRunId) {
      throw new Error("Cannot update prompt run: promptRunId is required");
    }
    
    console.log(`Updating prompt run ${promptRunId} with ${isError ? 'error' : 'result'}`);
    
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
    }
    
    return true;
  } catch (error) {
    console.error("Error updating prompt run with result:", error);
    return false;
  }
}
