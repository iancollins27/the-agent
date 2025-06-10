
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { findContactId } from "../utils/contactUtils.ts";

/**
 * Check if a string is a valid UUID format
 */
function isValidUUID(str: string): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Check if a string looks like a CRM ID (numeric string)
 */
function isCrmId(str: string): boolean {
  if (!str) return false;
  return /^\d+$/.test(str) && str.length > 10; // CRM IDs are typically long numeric strings
}

/**
 * Look up contact UUID by CRM ID
 */
async function findContactByCrmId(supabase: SupabaseClient, crmId: string): Promise<string | null> {
  try {
    console.log(`Looking up contact with CRM ID: ${crmId}`);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('profile_crm_id', crmId)
      .single();
    
    if (error || !data) {
      console.log(`No profile found with CRM ID ${crmId}`);
      return null;
    }
    
    console.log(`Found profile UUID ${data.id} for CRM ID ${crmId}`);
    return data.id;
  } catch (error) {
    console.error(`Error looking up CRM ID ${crmId}:`, error);
    return null;
  }
}

/**
 * Resolve sender/recipient ID to UUID, handling both CRM IDs and UUIDs
 */
async function resolveContactId(
  supabase: SupabaseClient, 
  id: string | null, 
  name: string | null, 
  projectId: string,
  type: 'sender' | 'recipient'
): Promise<string | null> {
  if (!id && !name) {
    console.log(`No ${type} ID or name provided`);
    return null;
  }
  
  // If we have an ID, try to resolve it
  if (id) {
    // Check if it's already a valid UUID
    if (isValidUUID(id)) {
      console.log(`${type} ID is already a valid UUID: ${id}`);
      return id;
    }
    
    // Check if it's a CRM ID
    if (isCrmId(id)) {
      console.log(`${type} ID appears to be a CRM ID: ${id}`);
      const uuid = await findContactByCrmId(supabase, id);
      if (uuid) {
        console.log(`Successfully resolved CRM ID ${id} to UUID ${uuid}`);
        return uuid;
      }
      console.log(`Could not resolve CRM ID ${id} to UUID`);
    } else {
      console.log(`${type} ID format not recognized: ${id}`);
    }
  }
  
  // Fall back to name-based lookup if ID resolution failed or no ID provided
  if (name) {
    console.log(`Attempting name-based lookup for ${type}: ${name}`);
    return await findContactId(supabase, name, projectId);
  }
  
  return null;
}

/**
 * Handle the message action type
 */
export async function handleMessageAction(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  actionData: any
) {
  console.log("handleMessageAction called with data:", JSON.stringify({
    action_type: actionData.action_type,
    recipient: actionData.recipient,
    recipient_id: actionData.recipient_id,
    sender: actionData.sender,
    sender_ID: actionData.sender_ID || actionData.sender_id
  }));
  
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
  
  // Extract sender and recipient info
  const rawSenderId = actionData.sender_ID || actionData.sender_id || 
                     (actionData.action_payload && (actionData.action_payload.sender_ID || actionData.action_payload.sender_id));
  
  const rawRecipientId = actionData.recipient_id || 
                        (actionData.action_payload && actionData.action_payload.recipient_id);
  
  const senderName = actionData.sender || 
                    (actionData.action_payload && actionData.action_payload.sender) || 
                    "BidList Project Manager";
  
  const recipientName = actionData.recipient || 
                       (actionData.action_payload && actionData.action_payload.recipient) || 
                       "Project team";
  
  console.log("Resolving contact IDs...");
  console.log("Raw sender ID:", rawSenderId, "Sender name:", senderName);
  console.log("Raw recipient ID:", rawRecipientId, "Recipient name:", recipientName);
  
  // Resolve sender and recipient IDs with improved error handling
  let senderId: string | null = null;
  let recipientId: string | null = null;
  
  try {
    senderId = await resolveContactId(supabase, rawSenderId, senderName, projectId, 'sender');
    console.log("Resolved sender ID:", senderId);
  } catch (error) {
    console.error("Error resolving sender ID:", error);
    senderId = null;
  }
  
  try {
    recipientId = await resolveContactId(supabase, rawRecipientId, recipientName, projectId, 'recipient');
    console.log("Resolved recipient ID:", recipientId);
  } catch (error) {
    console.error("Error resolving recipient ID:", error);
    recipientId = null;
  }
  
  // Additional validation to ensure we have valid UUIDs or null
  if (senderId && !isValidUUID(senderId)) {
    console.error("Sender ID is not a valid UUID after resolution:", senderId);
    senderId = null;
  }
  
  if (recipientId && !isValidUUID(recipientId)) {
    console.error("Recipient ID is not a valid UUID after resolution:", recipientId);
    recipientId = null;
  }

  // Prepare the action payload
  const actionPayload = {
    recipient: recipientName,
    sender: senderName,
    message_content: messageContent,
    recipient_id: recipientId,
    sender_ID: senderId
  };
  
  console.log("Creating message action with payload:", JSON.stringify(actionPayload));
  console.log("Final validation - senderId valid:", senderId ? isValidUUID(senderId) : 'null');
  console.log("Final validation - recipientId valid:", recipientId ? isValidUUID(recipientId) : 'null');
  
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
      console.error("Error details:", JSON.stringify(error, null, 2));
      throw new Error(`Failed to create action record: ${error.message}`);
    }
    
    console.log("Message action record created successfully:", data);
    return data.id;
  } catch (insertError) {
    console.error("Exception during action record insert:", insertError);
    console.error("Insert error details:", {
      senderId,
      recipientId,
      senderIdValid: senderId ? isValidUUID(senderId) : 'null',
      recipientIdValid: recipientId ? isValidUUID(recipientId) : 'null'
    });
    throw insertError;
  }
}
