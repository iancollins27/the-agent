
/**
 * Handler for message action type
 */
import { MessageActionParams } from '../types';
import { extractMessageContent } from '../../utils/formatting';

export async function handleMessageAction(
  supabase: any,
  promptRunId: string,
  projectId: string,
  actionData: MessageActionParams
): Promise<{ action_record_id?: string, error?: string }> {
  try {
    // Extract and validate message content
    let messageContent = extractMessageContent(actionData) || 
                         "Follow up on project status";
    
    // Extract recipient info with improved handling
    const recipient = actionData.recipient || "Project team";
    console.log("Recipient:", recipient);
    
    // Set default sender if not specified
    const sender = actionData.sender || "BidList Project Manager";
    console.log("Sender:", sender);
    
    // Find contact IDs for recipient and sender with improved role matching
    let recipientId = null;
    let senderId = null;
    
    try {
      // Find recipient by exact name or role match
      recipientId = await findContactId(supabase, recipient, projectId);
      console.log(`Recipient ID resolution: ${recipient} -> ${recipientId || 'Not found'}`);
      
      // If recipient not found by exact match, try to find by role type
      if (!recipientId) {
        // Try to find appropriate contact based on common role patterns
        if (isHomeownerRole(recipient)) {
          recipientId = await findContactId(supabase, "Homeowner", projectId);
          console.log(`Fallback recipient resolution for Homeowner: ${recipientId || 'Not found'}`);
        } else if (isRooferRole(recipient)) {
          recipientId = await findContactId(supabase, "Roofer", projectId);
          console.log(`Fallback recipient resolution for Roofer: ${recipientId || 'Not found'}`);
        } else if (isSolarRepRole(recipient)) {
          recipientId = await findContactId(supabase, "Solar Rep", projectId);
          console.log(`Fallback recipient resolution for Solar Rep: ${recipientId || 'Not found'}`);
        }
      }
      
      // Find sender contact ID
      senderId = await findContactId(supabase, sender, projectId);
      console.log(`Sender ID resolution: ${sender} -> ${senderId || 'Not found'}`);
      
      // If sender not found but contains "BidList" or "Project Manager", find a project manager contact
      if (!senderId && isProjectManagerRole(sender)) {
        senderId = await findProjectManagerId(supabase, projectId);
      }
    } catch (contactError) {
      console.error("Error finding contacts:", contactError);
    }
    
    // Prepare the action payload
    const actionPayload = {
      recipient: recipient,
      sender: sender,
      message_content: messageContent
    };
    
    console.log("Creating message action with payload:", actionPayload);
    
    // Create the action record
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
    return { action_record_id: data.id };
  } catch (error) {
    console.error("Exception during action record insert:", error);
    return { error: error.message || "Unknown error creating message action" };
  }
}

// Helper functions for role matching
function isHomeownerRole(role: string): boolean {
  const lowerRole = role.toLowerCase();
  return lowerRole.includes('homeowner') || 
         lowerRole.includes('customer') || 
         lowerRole.includes('client') ||
         lowerRole.includes('owner');
}

function isRooferRole(role: string): boolean {
  const lowerRole = role.toLowerCase();
  return lowerRole.includes('roofer') || 
         lowerRole.includes('contractor') ||
         lowerRole.includes('installer');
}

function isSolarRepRole(role: string): boolean {
  const lowerRole = role.toLowerCase();
  return lowerRole.includes('solar') || 
         lowerRole.includes('rep') || 
         lowerRole.includes('sales');
}

function isProjectManagerRole(role: string): boolean {
  const lowerRole = role.toLowerCase();
  return lowerRole.includes('bidlist') || 
         lowerRole.includes('project manager') ||
         lowerRole.includes('manager');
}

// Helper to find contact by role or name
async function findContactId(
  supabase: any,
  roleOrName: string, 
  projectId: string
): Promise<string | null> {
  try {
    // Try to find by matching role or name
    const { data } = await supabase
      .from('project_contacts')
      .select('contacts(id, role, full_name)')
      .eq('project_id', projectId)
      .or(`contacts.role.ilike.%${roleOrName}%,contacts.full_name.ilike.%${roleOrName}%`);
      
    if (data && data.length > 0 && data[0].contacts) {
      return data[0].contacts.id;
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding contact for ${roleOrName}:`, error);
    return null;
  }
}

// Helper to find a project manager contact
async function findProjectManagerId(
  supabase: any,
  projectId: string
): Promise<string | null> {
  try {
    // Try to find any project manager role
    const { data } = await supabase
      .from('project_contacts')
      .select('contacts(id, role, full_name)')
      .eq('project_id', projectId)
      .filter('contacts.role', 'ilike', '%manager%');
      
    if (data && data.length > 0 && data[0].contacts) {
      return data[0].contacts.id;
    }
    
    return null;
  } catch (error) {
    console.error("Error finding project manager:", error);
    return null;
  }
}
