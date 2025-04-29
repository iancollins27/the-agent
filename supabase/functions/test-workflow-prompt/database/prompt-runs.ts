
export async function logPromptRun(
  supabase: SupabaseClient,
  projectId: string | null, 
  workflowPromptId: string | null, 
  promptInput: string,
  aiProvider: string,
  aiModel: string
) {
  try {
    console.log("Logging prompt run with data:", {
      project_id: projectId,
      workflow_prompt_id: workflowPromptId,
      prompt_input: promptInput.substring(0, 100) + "...", // Log just the beginning for brevity
      ai_provider: aiProvider,
      ai_model: aiModel,
    });

    // Validate that promptInput is not empty
    if (!promptInput || promptInput.trim() === '') {
      console.error("Warning: Empty prompt input detected, using placeholder");
      promptInput = "Empty prompt was provided. This is a placeholder.";
    }

    // Create base insert object
    const insertData: any = {
      project_id: projectId,
      workflow_prompt_id: workflowPromptId,
      prompt_input: promptInput,
      status: 'PENDING',
      ai_provider: aiProvider,
      ai_model: aiModel,
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
    
    return data.id;
  } catch (error) {
    console.error("Error logging prompt run:", error);
    return null;
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
