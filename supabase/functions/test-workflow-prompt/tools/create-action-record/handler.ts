
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
    console.log("Create action record called with params:", JSON.stringify(params, null, 2));
    
    // Extract message content from various possible sources
    const messageContent = params.message || params.message_text || 
                          (params.action_payload && 
                           (params.action_payload.message || params.action_payload.message_text || params.action_payload.message_content)) || 
                          null;
    
    // Extract recipient ID directly or from action_payload
    const recipientId = params.recipient_id || 
                        (params.action_payload && params.action_payload.recipient_id) || 
                        null;
                        
    // Extract sender ID directly or from action_payload
    const senderId = params.sender_ID || params.sender_id || 
                    (params.action_payload && (params.action_payload.sender_ID || params.action_payload.sender_id)) || 
                    null;
    
    // Prepare the action record data
    const actionData = {
      prompt_run_id: promptRunId,
      project_id: projectId,
      action_type: params.action_type || 'message',
      message: messageContent,
      recipient_id: recipientId,
      sender_ID: senderId,
      requires_approval: params.requires_approval ?? true,
      action_payload: {
        ...params,
        recipient_id: recipientId,
        sender_ID: senderId,
        message_content: messageContent
      },
      status: (params.requires_approval ?? true) ? 'pending' : 'approved'
    };

    console.log("Action data to be inserted:", JSON.stringify({
      ...actionData,
      // Don't log potentially large or sensitive fields
      action_payload: "...(payload content)"
    }));

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

    console.log("Action record created successfully:", data.id);
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
