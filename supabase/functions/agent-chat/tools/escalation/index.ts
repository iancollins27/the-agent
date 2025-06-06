
/**
 * Escalation tool for agent-chat
 */
import { Tool, ToolContext, ToolResult } from '../types.ts';

// Schema for escalation tool
export const escalationSchema = {
  type: "object",
  properties: {
    reason: {
      type: "string",
      description: "The reason for escalating this project"
    },
    description: {
      type: "string", 
      description: "Detailed description of the escalation situation"
    },
    escalation_details: {
      type: "string",
      description: "Additional details about what requires escalation"
    },
    project_id: {
      type: "string",
      description: "The project ID that needs escalation"
    }
  },
  required: ["reason", "project_id"]
};

// Execute function for escalation
async function execute(args: any, context: ToolContext): Promise<ToolResult> {
  const { supabase, userProfile, companyId } = context;
  
  try {
    console.log(`Creating escalation action with args:`, JSON.stringify(args));

    // Get project details to validate and get company_id
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, project_name, company_id, summary, next_step, Address')
      .eq('id', args.project_id)
      .single();

    if (projectError || !projectData) {
      console.error("Error fetching project data:", projectError);
      return {
        status: "error",
        error: "Project not found or access denied"
      };
    }

    // Create the escalation action record
    const actionData = {
      action_type: 'escalation',
      project_id: args.project_id,
      requires_approval: false, // Escalations execute immediately
      action_payload: {
        reason: args.reason || 'Project requires escalation',
        description: args.description || 'Project has been escalated for manager review',
        escalation_details: args.escalation_details || 'No specific details provided',
        project_details: {
          name: projectData.project_name,
          address: projectData.Address,
          summary: projectData.summary,
          next_step: projectData.next_step
        }
      },
      status: 'pending', // Will be updated when escalation handler processes it
      created_by: userProfile?.id
    };

    console.log("Creating escalation action record with data:", actionData);

    const { data: actionRecord, error: actionError } = await supabase
      .from('action_records')
      .insert(actionData)
      .select()
      .single();

    if (actionError) {
      console.error("Error creating escalation action record:", actionError);
      return {
        status: "error",
        error: actionError.message || "Failed to create escalation action record"
      };
    }

    console.log("Escalation action record created:", actionRecord);

    // Now trigger the escalation handler by calling the test-workflow-prompt function
    // This will process the escalation and send notifications
    try {
      console.log("Triggering escalation handler for action:", actionRecord.id);
      
      const { data: escalationResult, error: escalationError } = await supabase.functions.invoke('test-workflow-prompt', {
        body: {
          action_type: 'process_escalation',
          action_record_id: actionRecord.id,
          project_id: args.project_id
        }
      });

      if (escalationError) {
        console.error("Error triggering escalation handler:", escalationError);
        // Don't fail the action creation, just log the error
        console.log("Escalation action record created but handler failed to trigger");
      } else {
        console.log("Escalation handler triggered successfully:", escalationResult);
      }
    } catch (handlerError) {
      console.error("Exception triggering escalation handler:", handlerError);
      // Don't fail the action creation, just log the error
    }

    return {
      status: "success",
      action_record_id: actionRecord.id,
      message: `Escalation created for project ${projectData.project_name}. Notifications will be sent to configured recipients.`
    };

  } catch (error) {
    console.error("Error in escalation tool:", error);
    return {
      status: "error",
      error: error.message || "An unexpected error occurred"
    };
  }
}

// Export the tool definition
export const escalationTool: Tool = {
  name: "escalation",
  description: "Creates an escalation for a project that requires immediate management attention due to issues, delays, or non-responsive contacts.",
  schema: escalationSchema,
  execute
};
