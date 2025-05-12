import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { findContactId } from "../utils/contactUtils.ts";

/**
 * Handle the message action type
 */
export async function handleMessageAction(
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
  
  // Extract recipient ID directly if provided
  let recipientId = actionData.recipient_id || 
                    (actionData.action_payload && actionData.action_payload.recipient_id) || 
                    null;
  
  // If recipient ID is not provided directly, try to look it up by name/role
  if (!recipientId) {
    // Extract recipient info
    const recipient = actionData.recipient || 
      (actionData.action_payload && actionData.action_payload.recipient) || 
      "Project team";
    
    console.log("Looking up recipient ID for:", recipient);
    
    // Find contact ID for recipient
    recipientId = await findContactId(supabase, recipient, projectId);
    console.log(`Recipient ID resolution: ${recipient} -> ${recipientId || 'Not found'}`);
  } else {
    console.log("Using provided recipient ID:", recipientId);
  }
  
  // Extract sender ID directly if provided
  let senderId = actionData.sender_ID || actionData.sender_id || 
                (actionData.action_payload && (actionData.action_payload.sender_ID || actionData.action_payload.sender_id)) || 
                null;
  
  // If sender ID is not provided directly, try to look it up by name/role
  if (!senderId) {
    // Extract sender info with default fallback to BidList Project Manager
    const sender = actionData.sender || 
      (actionData.action_payload && actionData.action_payload.sender) || 
      "BidList Project Manager";
    
    console.log("Looking up sender ID for:", sender);
    
    // Find contact ID for sender
    senderId = await findContactId(supabase, sender, projectId);
    console.log(`Sender ID resolution: ${sender} -> ${senderId || 'Not found'}`);
  } else {
    console.log("Using provided sender ID:", senderId);
  }
  
  // Extract or create description (we'll keep this minimal as per request)
  const description = null; // Remove the description as requested
  
  // Prepare the action payload
  const actionPayload = {
    recipient: actionData.recipient || (actionData.action_payload && actionData.action_payload.recipient),
    sender: actionData.sender || (actionData.action_payload && actionData.action_payload.sender),
    message_content: messageContent,
    recipient_id: recipientId,
    sender_ID: senderId
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
