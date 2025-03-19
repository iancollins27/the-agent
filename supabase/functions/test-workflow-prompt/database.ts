
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

/**
 * Sets the next check date for a project
 */
export async function setProjectNextCheckDate(
  supabase: SupabaseClient,
  projectId: string,
  daysUntilCheck: number
) {
  try {
    // Calculate the next check date
    const nextCheckDate = new Date();
    nextCheckDate.setDate(nextCheckDate.getDate() + daysUntilCheck);
    
    console.log(`Setting next check date for project ${projectId} to ${nextCheckDate.toISOString()} (${daysUntilCheck} days from now)`);
    
    const { error } = await supabase
      .from('projects')
      .update({
        next_check_date: nextCheckDate.toISOString()
      })
      .eq('id', projectId);
      
    if (error) {
      console.error("Error setting next check date:", error);
      throw new Error(`Failed to set next check date: ${error.message}`);
    }
    
    return nextCheckDate.toISOString();
  } catch (error) {
    console.error("Error setting project next check date:", error);
    return null;
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
          console.log("Found company ID:", companyId);
        }
      } catch (error) {
        console.error("Error getting company ID:", error);
      }
      
      // Handle different action types and formats
      if (actionType === "message") {
        // Extract message content from all possible locations with detailed logging
        let messageContent = null;
        
        console.log("Looking for message content in various fields");
        
        if (actionData.message_text) {
          console.log("Found message_text at top level");
          messageContent = actionData.message_text;
        } else if (actionData.message) {
          console.log("Found message at top level");
          messageContent = actionData.message;
        } else if (actionData.message_content) {
          console.log("Found message_content at top level");
          messageContent = actionData.message_content;
        } else if (actionData.action_payload) {
          console.log("Checking action_payload for message");
          if (actionData.action_payload.message_text) {
            console.log("Found message_text in action_payload");
            messageContent = actionData.action_payload.message_text;
          } else if (actionData.action_payload.message) {
            console.log("Found message in action_payload");
            messageContent = actionData.action_payload.message;
          } else if (actionData.action_payload.message_content) {
            console.log("Found message_content in action_payload");
            messageContent = actionData.action_payload.message_content;
          }
        }
        
        if (!messageContent) {
          console.log("No message content found, using default");
          messageContent = "Follow up on project status";
        } else {
          console.log("Final message content:", messageContent);
        }
        
        // Extract recipient
        const recipient = actionData.recipient || 
          (actionData.action_payload && actionData.action_payload.recipient) || 
          "Project team";
        
        console.log("Recipient:", recipient);
        
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
        
        console.log("Description:", description);
        
        // Prepare the action payload
        const actionPayload = {
          recipient: recipient,
          message_content: messageContent,
          description: description
        };
        
        console.log("Creating message action with payload:", actionPayload);
        
        try {
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
        } catch (insertError) {
          console.error("Exception during action record insert:", insertError);
          return null;
        }
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
        
        try {
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
        } catch (insertError) {
          console.error("Exception during action record insert:", insertError);
          return null;
        }
      }
    } 
    // Handle SET_FUTURE_REMINDER action type specially
    else if (decision === "SET_FUTURE_REMINDER" || actionData.action_type === "set_future_reminder") {
      // Calculate the next check date
      const daysToAdd = actionData.days_until_check || 7; // Default to 7 days if not specified
      const nextCheckDate = await setProjectNextCheckDate(supabase, projectId, daysToAdd);
      
      if (!nextCheckDate) {
        console.error("Failed to set next check date for project", projectId);
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
