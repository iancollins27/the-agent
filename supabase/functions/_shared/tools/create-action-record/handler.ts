
/**
 * Handler for create-action-record tool
 * Uses agent-as-sender model - messages are sent from the AI agent, not a person
 */

import { ToolContext, ToolResult } from '../types.ts';

/**
 * Handle message action type - creates action record with agent as sender
 */
async function handleMessageAction(
  supabase: any,
  promptRunId: string,
  projectId: string,
  params: any
): Promise<string | null> {
  try {
    console.log("handleMessageAction called with params:", JSON.stringify(params, null, 2));
    
    // Get project details including company
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, company_id, project_name")
      .eq("id", projectId)
      .single();
      
    if (projectError || !project) {
      console.error("Error fetching project:", projectError);
      throw new Error(`Failed to fetch project: ${projectError?.message || "Project not found"}`);
    }
    
    // Resolve recipient ID
    let recipientId = params.recipient_id || null;
    if (!recipientId && params.recipient) {
      recipientId = await findContactByNameOrRole(supabase, params.recipient, projectId);
    }
    
    if (!recipientId) {
      console.error("Could not resolve recipient:", params.recipient);
      throw new Error(`Could not find recipient: ${params.recipient || "No recipient specified"}`);
    }
    
    // Get the message content
    const messageContent = params.message || params.message_text || "";
    if (!messageContent) {
      throw new Error("No message content provided");
    }
    
    // Build action payload with agent-as-sender model
    const actionPayload = {
      message: messageContent,
      recipient_id: recipientId,
      sender_type: "agent",  // Agent is the sender, not a person
      priority: params.priority || "medium",
      channel: params.channel || "sms"
    };
    
    // Create the action record
    const { data: actionRecord, error: insertError } = await supabase
      .from("action_records")
      .insert({
        project_id: projectId,
        prompt_run_id: promptRunId,
        action_type: "message",
        action_payload: actionPayload,
        message: messageContent,
        recipient_id: recipientId,
        status: "pending",
        requires_approval: true
      })
      .select("id")
      .single();
      
    if (insertError) {
      console.error("Error inserting action record:", insertError);
      throw new Error(`Failed to create action record: ${insertError.message}`);
    }
    
    console.log("Created message action record:", actionRecord.id);
    return actionRecord.id;
  } catch (error) {
    console.error("Error in handleMessageAction:", error);
    throw error;
  }
}

/**
 * Handle other action types (data_update, set_future_reminder, etc.)
 */
async function handleOtherActionTypes(
  supabase: any,
  promptRunId: string,
  projectId: string,
  params: any,
  actionType: string
): Promise<ToolResult> {
  try {
    console.log(`handleOtherActionTypes called for ${actionType}:`, JSON.stringify(params, null, 2));
    
    // Build action payload based on type
    let actionPayload: any = {
      action_type: actionType,
      priority: params.priority || "medium"
    };
    
    // Add type-specific fields
    switch (actionType) {
      case "data_update":
        actionPayload.data_field = params.data_field;
        actionPayload.data_value = params.data_value;
        actionPayload.description = params.description;
        break;
        
      case "set_future_reminder":
        actionPayload.days_until_check = params.days_until_check;
        actionPayload.check_reason = params.check_reason || params.reason;
        // Calculate reminder date
        if (params.days_until_check) {
          const reminderDate = new Date();
          reminderDate.setDate(reminderDate.getDate() + params.days_until_check);
          actionPayload.reminder_date = reminderDate.toISOString();
        }
        break;
        
      case "escalation":
        actionPayload.escalation_details = params.escalation_details;
        actionPayload.reason = params.reason;
        break;
        
      case "human_in_loop":
        actionPayload.description = params.description;
        actionPayload.reason = params.reason;
        break;
        
      default:
        actionPayload.description = params.description;
        actionPayload.reason = params.reason;
    }
    
    // Create the action record
    const { data: actionRecord, error: insertError } = await supabase
      .from("action_records")
      .insert({
        project_id: projectId,
        prompt_run_id: promptRunId,
        action_type: actionType,
        action_payload: actionPayload,
        message: params.description || params.reason || null,
        reminder_date: actionPayload.reminder_date || null,
        status: "pending",
        requires_approval: actionType !== "set_future_reminder"
      })
      .select("id")
      .single();
      
    if (insertError) {
      console.error("Error inserting action record:", insertError);
      return {
        status: "error",
        error: `Failed to create action record: ${insertError.message}`
      };
    }
    
    console.log(`Created ${actionType} action record:`, actionRecord.id);
    return {
      status: "success",
      action_record_id: actionRecord.id,
      message: `Created ${actionType} action record`
    };
  } catch (error) {
    console.error("Error in handleOtherActionTypes:", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}

/**
 * Find a contact by name or role within a project
 */
async function findContactByNameOrRole(
  supabase: any,
  nameOrRole: string,
  projectId?: string
): Promise<string | null> {
  try {
    console.log(`Looking up contact: "${nameOrRole}" for project: ${projectId}`);
    
    if (!nameOrRole) return null;
    
    const searchTerm = nameOrRole.toLowerCase().trim();
    
    // If we have a project ID, search within project contacts first
    if (projectId) {
      // Get contact IDs for this project
      const { data: projectContacts, error: pcError } = await supabase
        .from("project_contacts")
        .select("contact_id")
        .eq("project_id", projectId);
        
      if (pcError) {
        console.error("Error fetching project contacts:", pcError);
      }
      
      if (projectContacts && projectContacts.length > 0) {
        const contactIds = projectContacts.map((pc: any) => pc.contact_id);
        
        // Search within project contacts
        const { data: contacts, error: contactsError } = await supabase
          .from("contacts")
          .select("id, full_name, role, email")
          .in("id", contactIds);
          
        if (!contactsError && contacts) {
          // Try exact name match
          const exactMatch = contacts.find((c: any) => 
            c.full_name?.toLowerCase() === searchTerm
          );
          if (exactMatch) {
            console.log(`Found exact name match: ${exactMatch.id}`);
            return exactMatch.id;
          }
          
          // Try role match
          const roleMatch = contacts.find((c: any) => 
            c.role?.toLowerCase() === searchTerm ||
            c.role?.toLowerCase().includes(searchTerm) ||
            searchTerm.includes(c.role?.toLowerCase())
          );
          if (roleMatch) {
            console.log(`Found role match: ${roleMatch.id}`);
            return roleMatch.id;
          }
          
          // Try partial name match
          const partialMatch = contacts.find((c: any) =>
            c.full_name?.toLowerCase().includes(searchTerm) ||
            searchTerm.includes(c.full_name?.toLowerCase())
          );
          if (partialMatch) {
            console.log(`Found partial name match: ${partialMatch.id}`);
            return partialMatch.id;
          }
        }
      }
    }
    
    // Fallback: global search by name or role
    const { data: globalContacts, error: globalError } = await supabase
      .from("contacts")
      .select("id, full_name, role")
      .or(`full_name.ilike.%${searchTerm}%,role.ilike.%${searchTerm}%`)
      .limit(1);
      
    if (!globalError && globalContacts && globalContacts.length > 0) {
      console.log(`Found global match: ${globalContacts[0].id}`);
      return globalContacts[0].id;
    }
    
    console.log(`No contact found for: ${nameOrRole}`);
    return null;
  } catch (error) {
    console.error("Error in findContactByNameOrRole:", error);
    return null;
  }
}

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
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}

export async function handleCreateActionRecord(args: any, context: ToolContext): Promise<ToolResult> {
  const { supabase, promptRunId, projectId } = context;
  
  // Use projectId from context, or fall back to args
  const resolvedProjectId = projectId || args.project_id;
  const resolvedPromptRunId = promptRunId || args.prompt_run_id || null;
  
  if (!resolvedProjectId) {
    return {
      status: "error",
      error: "Project ID is required - either in context or args"
    };
  }
  
  // Call the function to create the action record
  return await createActionRecord(supabase, resolvedPromptRunId, resolvedProjectId, args);
}
