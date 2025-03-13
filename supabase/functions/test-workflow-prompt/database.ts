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
      return null;
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
    console.log("Creating action record with data:", actionData);
    
    // Parse the decision and other data from the AI response
    const decision = actionData.decision;
    
    // Only create an action record if the decision is ACTION_NEEDED
    if (decision === "ACTION_NEEDED") {
      // Extract action type from response or default to message
      const actionType = actionData.action_type || "message";
      
      // Get the company ID from the project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('company_id')
        .eq('id', projectId)
        .single();
        
      if (projectError) {
        console.error("Error fetching project:", projectError);
        return null;
      }
      
      // Handle different action types and formats
      if (actionType === "message") {
        // Check for message content in different possible locations
        const messageContent = 
          actionData.message_content || 
          actionData.message_text || 
          (actionData.action_payload && actionData.action_payload.message) ||
          (actionData.action_payload && actionData.action_payload.message_content) || 
          "Follow up on project status";
        
        // Check for recipient in different possible locations
        const recipient = 
          actionData.recipient || 
          (actionData.action_payload && actionData.action_payload.recipient) || 
          "Project team";
        
        // Check for description in different possible locations
        const description = 
          actionData.description || 
          (actionData.action_payload && actionData.action_payload.description) ||
          (actionData.action_payload && actionData.action_payload.reason) ||
          actionData.reason ||
          `Send message to ${recipient}`;
        
        console.log("Creating message action with:", {
          message: messageContent,
          recipient: recipient,
          description: description
        });
        
        const { data, error } = await supabase
          .from('action_records')
          .insert({
            prompt_run_id: promptRunId,
            project_id: projectId,
            action_type: 'message',
            action_payload: {
              recipient: recipient,
              message_content: messageContent,
              description: description
            },
            message: messageContent,
            requires_approval: true,
            status: 'pending'
          })
          .select()
          .single();
        
        if (error) {
          console.error("Error creating message action record:", error);
          return null;
        }
        
        console.log("Message action record created successfully:", data);
        return data.id;
      } else {
        // Use provided action_payload or build a default one
        const actionPayload = actionData.action_payload || {
          message_text: actionData.message_text || "Follow up on project status",
          reason: actionData.reason || "No specific reason provided",
          description: actionData.description || actionData.reason || "Project action required"
        };
        
        console.log("Creating action record with payload:", {
          prompt_run_id: promptRunId,
          project_id: projectId,
          action_type: actionType,
          action_payload: actionPayload,
          requires_approval: true,
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
          return null;
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
        return null;
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
        return null;
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
