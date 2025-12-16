
/**
 * Handler for create-action-record tool
 */
import { ToolContext, ToolResult } from '../types.ts';
import { handleMessageAction } from '../../database/handlers/messageActionHandler.ts';
import { handleOtherActionTypes } from '../../database/handlers/otherActionHandler.ts';

/**
 * Create an action record in the database
 */
async function createActionRecord(
  supabase: any, 
  promptRunId: string, 
  projectId: string, 
  params: any
): Promise<ToolResult> {
  try {
    console.log("Create action record called with params:", JSON.stringify(params, null, 2));
    
    // Normalize action type
    const actionType = params.action_type?.toLowerCase() || 'message';
    
    // For message actions, use the specialized handler
    if (actionType === 'message') {
      console.log("Processing as message action");
      const actionRecordId = await handleMessageAction(
        supabase,
        promptRunId,
        projectId,
        params
      );
      
      if (!actionRecordId) {
        throw new Error("Failed to create message action record");
      }
      
      return {
        status: "success",
        action_record_id: actionRecordId,
        message: `Created message action record`
      };
    }
    
    // For other action types, use the general handler
    console.log(`Processing as ${actionType} action`);
    return await handleOtherActionTypes(
      supabase,
      promptRunId,
      projectId,
      params,
      actionType
    );
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
