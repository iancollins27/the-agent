
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
