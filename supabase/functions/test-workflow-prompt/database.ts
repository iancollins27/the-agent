
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

    const { data, error } = await supabase
      .from('prompt_runs')
      .insert({
        project_id: projectId,
        workflow_prompt_id: workflowPromptId,
        prompt_input: promptInput,
        status: 'PENDING',
        ai_provider: aiProvider,
        ai_model: aiModel,
        initiated_by: initiatedBy
      })
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
  if (!promptRunId) return;
  
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
    }
  } catch (error) {
    console.error("Error updating prompt run:", error);
  }
}

/**
 * Creates an action record from action detection+execution results
 */
export async function createActionRecord(
  supabase: SupabaseClient,
  promptRunId: string, 
  projectId: string, 
  actionData: any
) {
  try {
    console.log("Creating action record with data:", JSON.stringify(actionData, null, 2));
    
    // Parse the decision and other data from the AI response
    const decision = actionData.decision;
    
    // Only create an action record if the decision is ACTION_NEEDED
    if (decision === "ACTION_NEEDED") {
      // Extract action type from response or default to message
      const actionType = actionData.action_type || "message";
      
      console.log("Action type detected:", actionType);
      
      // Get the company ID from the project
      let companyId = null;
      try {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('company_id')
          .eq('id', projectId)
          .single();
          
        if (projectError) {
          console.error("Error fetching project:", projectError);
        } else {
          companyId = projectData.company_id;
        }
      } catch (error) {
        console.error("Error getting company ID:", error);
      }
      
      // Handle different action types and formats
      if (actionType === "message") {
        // Extract message content from all possible locations
        let messageContent = null;
        if (actionData.message_content) {
          messageContent = actionData.message_content;
        } else if (actionData.message_text) {
          messageContent = actionData.message_text;
        } else if (actionData.action_payload) {
          if (actionData.action_payload.message_content) {
            messageContent = actionData.action_payload.message_content;
          } else if (actionData.action_payload.message_text) {
            messageContent = actionData.action_payload.message_text;
          } else if (actionData.action_payload.message) {
            messageContent = actionData.action_payload.message;
          }
        }
        
        if (!messageContent) {
          messageContent = "Follow up on project status";
        }
        
        // Extract recipient
        const recipient = actionData.recipient || 
          (actionData.action_payload && actionData.action_payload.recipient) || 
          "Project team";
        
        // Extract or create description
        let description = null;
        if (actionData.description) {
          description = actionData.description;
        } else if (actionData.reason) {
          description = actionData.reason;
        } else if (actionData.action_payload) {
          if (actionData.action_payload.description) {
            description = actionData.action_payload.description;
          } else if (actionData.action_payload.reason) {
            description = actionData.action_payload.reason;
          }
        }
        
        if (!description) {
          description = `Send message to ${recipient}`;
        }
        
        console.log("Creating message action with:", {
          message: messageContent,
          recipient: recipient,
          description: description
        });
        
        // Prepare the action payload
        const actionPayload = {
          recipient: recipient,
          message_content: messageContent,
          description: description
        };
        
        const { data, error } = await supabase
          .from('action_records')
          .insert({
            prompt_run_id: promptRunId,
            project_id: projectId,
            action_type: 'message',
            action_payload: actionPayload,
            message: messageContent,
            requires_approval: true,
            status: 'pending'
          })
          .select()
          .single();
        
        if (error) {
          console.error("Error creating message action record:", error);
          throw new Error(`Failed to create action record: ${error.message}`);
        }
        
        console.log("Message action record created successfully:", data);
        return data.id;
      } else {
        // For other action types
        
        // Build a proper action_payload with all required fields
        let actionPayload: any = {};
        
        if (actionData.action_payload) {
          actionPayload = { ...actionData.action_payload };
        }
        
        // Ensure description exists in action_payload
        if (!actionPayload.description) {
          actionPayload.description = actionData.description || 
                                     actionData.reason || 
                                     "Project action required";
        }
        
        // Add any other common fields that might be useful
        if (actionData.message_text && !actionPayload.message_text) {
          actionPayload.message_text = actionData.message_text;
        }
        
        if (actionData.recipient && !actionPayload.recipient) {
          actionPayload.recipient = actionData.recipient;
        }
        
        console.log("Creating action record with payload:", {
          action_type: actionType,
          action_payload: actionPayload,
        });
        
        const { data, error } = await supabase
          .from('action_records')
          .insert({
            prompt_run_id: promptRunId,
            project_id: projectId,
            action_type: actionType,
            action_payload: actionPayload,
            requires_approval: true,
            status: 'pending'
          })
          .select()
          .single();
          
        if (error) {
          console.error("Error creating action record:", error);
          throw new Error(`Failed to create action record: ${error.message}`);
        }
        
        console.log("Action record created successfully:", data);
        return data.id;
      }
    } 
    // Handle SET_FUTURE_REMINDER action type specially
    else if (decision === "SET_FUTURE_REMINDER" || actionData.action_type === "set_future_reminder") {
      // Calculate the next check date
      const daysToAdd = actionData.days_until_check || 7; // Default to 7 days if not specified
      const nextCheckDate = new Date();
      nextCheckDate.setDate(nextCheckDate.getDate() + daysToAdd);
      
      // Update the project with the next check date
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          next_check_date: nextCheckDate.toISOString()
        })
        .eq('id', projectId);
        
      if (updateError) {
        console.error("Error setting next check date:", updateError);
        throw new Error(`Failed to set next check date: ${updateError.message}`);
      }
      
      // Create an action record to document the reminder setting
      const { data, error } = await supabase
        .from('action_records')
        .insert({
          prompt_run_id: promptRunId,
          project_id: projectId,
          action_type: 'set_future_reminder',
          action_payload: {
            days_until_check: daysToAdd,
            check_reason: actionData.check_reason || 'Follow-up check',
            description: `Set reminder to check in ${daysToAdd} days: ${actionData.check_reason || 'Follow-up check'}`
          },
          requires_approval: false,
          status: 'executed',
          executed_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error("Error creating reminder action record:", error);
        throw new Error(`Failed to create reminder action record: ${error.message}`);
      }
      
      console.log("Reminder action record created successfully:", data);
      return data.id;
    } else {
      console.log("No action needed based on AI decision:", decision);
      return null;
    }
  } catch (error) {
    console.error("Error creating action record:", error);
    return null;
  }
}
