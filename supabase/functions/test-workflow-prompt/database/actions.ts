
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { setProjectNextCheckDate } from "./projects.ts";

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
      return await handleActionNeeded(supabase, promptRunId, projectId, actionData);
    } 
    // Handle SET_FUTURE_REMINDER action type specially
    else if (decision === "SET_FUTURE_REMINDER" || actionData.action_type === "set_future_reminder") {
      return await handleFutureReminder(supabase, promptRunId, projectId, actionData);
    } else {
      console.log("No action needed based on AI decision:", decision);
      return null;
    }
  } catch (error) {
    console.error("Error creating action record:", error);
    return null;
  }
}

/**
 * Handle the ACTION_NEEDED decision type
 */
async function handleActionNeeded(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  actionData: any
) {
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
    return await handleMessageAction(supabase, promptRunId, projectId, actionData);
  } else {
    return await handleOtherActionTypes(supabase, promptRunId, projectId, actionData, actionType);
  }
}

/**
 * Find a contact by name, role, or partial match
 */
async function findContactId(
  supabase: SupabaseClient,
  contactName: string,
  projectId: string
): Promise<string | null> {
  if (!contactName || contactName.trim().length < 3) {
    return null;
  }

  // Try to find the contact by exact name match first
  try {
    // Check project_contacts first to get contacts associated with this project
    const { data: projectContacts, error: projectContactsError } = await supabase
      .from('project_contacts')
      .select('contact_id')
      .eq('project_id', projectId);
    
    if (projectContactsError) {
      console.error("Error fetching project contacts:", projectContactsError);
    } else if (projectContacts && projectContacts.length > 0) {
      // If we have project contacts, look for a match among them
      const contactIds = projectContacts.map(pc => pc.contact_id);
      
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, full_name, role')
        .in('id', contactIds);
      
      if (contactsError) {
        console.error("Error fetching contacts by IDs:", contactsError);
      } else if (contacts && contacts.length > 0) {
        // Try exact match on full name
        const exactMatch = contacts.find(c => 
          c.full_name.toLowerCase() === contactName.toLowerCase());
        
        if (exactMatch) return exactMatch.id;
        
        // Try partial match on full name
        const partialMatch = contacts.find(c => 
          c.full_name.toLowerCase().includes(contactName.toLowerCase()) || 
          contactName.toLowerCase().includes(c.full_name.toLowerCase()));
        
        if (partialMatch) return partialMatch.id;
        
        // Try matching by role
        const roleMatch = contacts.find(c => 
          c.role && c.role.toLowerCase() === contactName.toLowerCase());
        
        if (roleMatch) return roleMatch.id;
      }
    }
    
    // If no match found in project contacts, try all contacts as a fallback
    const { data: allContacts, error: allContactsError } = await supabase
      .from('contacts')
      .select('id, full_name, role')
      .ilike('full_name', `%${contactName}%`);
    
    if (allContactsError) {
      console.error("Error searching all contacts:", allContactsError);
    } else if (allContacts && allContacts.length > 0) {
      console.log(`Found contact match for "${contactName}": ${allContacts[0].full_name}`);
      return allContacts[0].id;
    }
    
    console.log(`No contact found for name: "${contactName}"`);
    return null;
  } catch (error) {
    console.error("Error finding contact:", error);
    return null;
  }
}

/**
 * Handle the message action type
 */
async function handleMessageAction(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  actionData: any
) {
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
  
  // Extract recipient info
  const recipient = actionData.recipient || 
    (actionData.action_payload && actionData.action_payload.recipient) || 
    "Project team";
  
  console.log("Recipient:", recipient);
  
  // Extract sender info
  const sender = actionData.sender || 
    (actionData.action_payload && actionData.action_payload.sender) || 
    "BidList Project Manager";
    
  console.log("Sender:", sender);
  
  // Find contact IDs for recipient and sender
  let recipientId = null;
  let senderId = null;
  
  try {
    recipientId = await findContactId(supabase, recipient, projectId);
    console.log(`Recipient ID resolution: ${recipient} -> ${recipientId || 'Not found'}`);
    
    senderId = await findContactId(supabase, sender, projectId);
    console.log(`Sender ID resolution: ${sender} -> ${senderId || 'Not found'}`);
  } catch (contactError) {
    console.error("Error finding contacts:", contactError);
  }
  
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
    sender: sender,
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
        recipient_id: recipientId,
        sender_ID: senderId,
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
}

/**
 * Handle other action types
 */
async function handleOtherActionTypes(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  actionData: any,
  actionType: string
) {
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
  
  if (actionData.sender && !actionPayload.sender) {
    actionPayload.sender = actionData.sender;
  }
  
  // Try to resolve recipient and sender IDs if applicable
  let recipientId = null;
  let senderId = null;
  
  try {
    if (actionData.recipient) {
      recipientId = await findContactId(supabase, actionData.recipient, projectId);
      console.log(`Recipient ID resolution: ${actionData.recipient} -> ${recipientId || 'Not found'}`);
    }
    
    if (actionData.sender) {
      senderId = await findContactId(supabase, actionData.sender, projectId);
      console.log(`Sender ID resolution: ${actionData.sender} -> ${senderId || 'Not found'}`);
    }
  } catch (contactError) {
    console.error("Error finding contacts:", contactError);
  }
  
  console.log("Creating action record with payload:", {
    action_type: actionType,
    action_payload: actionPayload,
    recipient_id: recipientId,
    sender_ID: senderId
  });
  
  try {
    const { data, error } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: actionType,
        action_payload: actionPayload,
        recipient_id: recipientId,
        sender_ID: senderId,
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

/**
 * Handle SET_FUTURE_REMINDER decision type
 */
async function handleFutureReminder(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  actionData: any
) {
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
}
