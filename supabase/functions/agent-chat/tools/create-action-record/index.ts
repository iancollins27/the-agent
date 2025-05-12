
/**
 * Create action record tool for agent-chat
 */
import { Tool, ToolContext, ToolResult } from '../types.ts';

// Schema for create_action_record
export const createActionRecordSchema = {
  type: "object",
  properties: {
    action_type: {
      type: "string",
      description: "Type of action to record (e.g., 'message', 'data_update', 'set_future_reminder')"
    },
    message: {
      type: "string",
      description: "Message content for message actions, or description for other action types"
    },
    recipient_id: {
      type: "string",
      description: "ID of the recipient for message actions (if available)"
    },
    requires_approval: {
      type: "boolean",
      description: "Whether this action requires human approval before execution"
    },
    action_payload: {
      type: "object",
      description: "Additional data specific to the action type"
    }
  },
  required: ["action_type"]
};

// Execute function for create_action_record
async function execute(args: any, context: ToolContext): Promise<ToolResult> {
  const { supabase, userProfile, companyId } = context;
  
  try {
    // Extract user and project information from the context
    const userId = userProfile?.id; 
    const projectId = args.project_id;

    // Prepare the action record data
    const actionData = {
      action_type: args.action_type,
      message: args.message || null,
      recipient_id: args.recipient_id || null,
      requires_approval: args.requires_approval ?? true,
      action_payload: args.action_payload || {},
      status: (args.requires_approval ?? true) ? 'pending' : 'approved',
      project_id: projectId,
      company_id: companyId,
      created_by: userId,
    };

    console.log("Creating action record:", actionData);

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

    console.log("Action record created:", data);
    return {
      status: "success",
      action_record_id: data.id,
      message: `Created ${args.action_type} action record`
    };
  } catch (error) {
    console.error("Error in create_action_record tool:", error);
    return {
      status: "error",
      error: error.message || "An unexpected error occurred"
    };
  }
}

// Export the tool definition
export const createActionRecord: Tool = {
  name: "create_action_record",
  description: "Creates an action record based on your analysis. Use this when you determine an action is needed (message, data update, or set a reminder).",
  schema: createActionRecordSchema,
  execute
};
