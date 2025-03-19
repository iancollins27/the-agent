
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

    // Create base insert object without the initiatedBy field in case it doesn't exist
    const insertData: any = {
      project_id: projectId,
      workflow_prompt_id: workflowPromptId,
      prompt_input: promptInput,
      status: 'PENDING',
      ai_provider: aiProvider,
      ai_model: aiModel,
    };

    // Only add initiated_by if provided (this helps avoid DB errors if column doesn't exist)
    if (initiatedBy) {
      // Check if initiatedBy column exists before adding it
      try {
        // Get column information from the table
        const { data: columns, error: columnsError } = await supabase
          .from('prompt_runs')
          .select('*')
          .limit(1);
      
        // If there's a test row and it has the initiated_by property, we can use it
        if (!columnsError && columns && columns.length > 0) {
          const testRow = columns[0];
          const hasInitiatedBy = 'initiated_by' in testRow;
          
          if (hasInitiatedBy) {
            insertData.initiated_by = initiatedBy;
          } else {
            console.log("'initiated_by' column doesn't exist in prompt_runs table, skipping this field");
          }
        }
      } catch (columnCheckError) {
        console.error("Error checking for initiated_by column:", columnCheckError);
        // Continue without adding the field
      }
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
