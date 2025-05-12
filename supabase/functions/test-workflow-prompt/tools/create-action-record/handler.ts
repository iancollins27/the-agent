
/**
 * Handler for create-action-record tool
 */
import { ToolContext, ToolResult } from '../types.ts';

/**
 * Create an action record in the database
 * @returns The ID of the newly created action record, or null if creation failed
 */
async function createActionRecord(
  supabase: any, 
  promptRunId: string, 
  projectId: string, 
  params: any
): Promise<ToolResult> {
  try {
    // Prepare the action record data
    const actionData = {
      prompt_run_id: promptRunId,
      project_id: projectId,
      action_type: params.action_type || 'message',
      message: params.message || null,
      recipient_id: params.recipient_id || null,
      requires_approval: params.requires_approval ?? true,
      action_payload: params.action_payload || {},
      status: (params.requires_approval ?? true) ? 'pending' : 'approved'
    };

    // Insert the action record
    const { data, error } = await supabase
      .from('action_records')
      .insert(actionData)
      .select()
      .single();

    if (error) {
      console.error("Error creating action record:", error);
      return {
        status: "error",
        error: error.message || "Failed to create action record"
      };
    }

    return {
      status: "success",
      action_record_id: data.id,
      message: `Created ${params.action_type || 'message'} action record`
    };
  } catch (error) {
    console.error("Error in create_action_record tool:", error);
    return {
      status: "error",
      error: error.message || "An unexpected error occurred"
    };
  }
}

export async function handleCreateActionRecord(args: any, context: ToolContext): Promise<ToolResult> {
  const { supabase, promptRunId, projectId } = context;
  
  // Call the function to create the action record
  return await createActionRecord(supabase, promptRunId, projectId, args);
}
