

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

    // Create base insert object without the initiated_by field
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
