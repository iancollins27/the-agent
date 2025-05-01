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
  
  // Extract recipient info - more targeted recipient selection
  const recipient = actionData.recipient || 
    (actionData.action_payload && actionData.action_payload.recipient) || 
    "Project team";
  
  console.log("Recipient:", recipient);
  
  // Extract sender info with default fallback to BidList Project Manager
  const sender = actionData.sender || 
    (actionData.action_payload && actionData.action_payload.sender) || 
    "BidList Project Manager";
    
  console.log("Sender:", sender);
  
  // Find contact IDs for recipient and sender with improved role matching
  let recipientId = null;
  let senderId = null;
  
  try {
    // Try to find recipient by exact name or role match first
    recipientId = await findContactId(supabase, recipient, projectId);
    console.log(`Recipient ID resolution: ${recipient} -> ${recipientId || 'Not found'}`);
    
    // If recipient not found by exact match, try to find by role type
    if (!recipientId) {
      // Try to find appropriate contact based on common role patterns
      if (recipient.toLowerCase().includes('homeowner') || 
          recipient.toLowerCase().includes('customer') || 
          recipient.toLowerCase().includes('client')) {
        recipientId = await findContactId(supabase, "Homeowner", projectId);
        console.log(`Fallback recipient resolution for Homeowner: ${recipientId || 'Not found'}`);
      } else if (recipient.toLowerCase().includes('roofer') || 
                recipient.toLowerCase().includes('contractor')) {
        recipientId = await findContactId(supabase, "Roofer", projectId);
        console.log(`Fallback recipient resolution for Roofer: ${recipientId || 'Not found'}`);
      } else if (recipient.toLowerCase().includes('solar') || 
                recipient.toLowerCase().includes('rep') || 
                recipient.toLowerCase().includes('sales')) {
        recipientId = await findContactId(supabase, "Solar Rep", projectId);
        console.log(`Fallback recipient resolution for Solar Rep: ${recipientId || 'Not found'}`);
      }
    }
    
    // Find sender contact ID with similar fallback logic
    senderId = await findContactId(supabase, sender, projectId);
    console.log(`Sender ID resolution: ${sender} -> ${senderId || 'Not found'}`);
    
    // If senderId is not found but sender contains "BidList" or "Project Manager", try finding a project manager contact
    if (!senderId && (sender.includes("BidList") || sender.includes("Project Manager"))) {
      senderId = await findContactId(supabase, "Project Manager", projectId);
      console.log(`Fallback sender ID resolution for Project Manager: ${senderId || 'Not found'}`);
      
      // If still not found, try any variant of Project Manager role
      if (!senderId) {
        const { data } = await supabase
          .from('project_contacts')
          .select('contacts(id, role, full_name)')
          .eq('project_id', projectId)
          .filter('contacts.role', 'ilike', '%manager%');
        
        if (data && data.length > 0 && data[0].contacts) {
          senderId = data[0].contacts.id;
          console.log(`Found project manager by role pattern: ${senderId}`);
        }
      }
    }
  } catch (contactError) {
    console.error("Error finding contacts:", contactError);
  }
  
  // Extract or create description (we'll keep this minimal as per request)
  const description = null; // Remove the description as requested
  
  // Prepare the action payload
  const actionPayload = {
    recipient: recipient,
    sender: sender,
    message_content: messageContent
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
