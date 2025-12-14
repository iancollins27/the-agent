
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
 * Get company info including agent configuration
 */
async function getCompanyAgentInfo(supabase: SupabaseClient, projectId: string): Promise<{ name: string; agentName: string | null; agentPhone: string | null }> {
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('company_id')
      .eq('id', projectId)
      .single();
    
    if (!project?.company_id) {
      return { name: 'Unknown Company', agentName: null, agentPhone: null };
    }
    
    const { data: company } = await supabase
      .from('companies')
      .select('name, agent_name, agent_phone_number')
      .eq('id', project.company_id)
      .single();
    
    return {
      name: company?.name || 'Unknown Company',
      agentName: company?.agent_name || null,
      agentPhone: company?.agent_phone_number || null
    };
  } catch (error) {
    console.error('Error fetching company agent info:', error);
    return { name: 'Unknown Company', agentName: null, agentPhone: null };
  }
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
    recipient_id: actionData.recipient_id
  }));
  
  // Get company agent info - agent is always the sender
  const companyInfo = await getCompanyAgentInfo(supabase, projectId);
  const agentName = companyInfo.agentName || `${companyInfo.name} Agent`;
  
  console.log(`Agent sender: ${agentName}`);
  
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
  
  // Extract recipient info (sender is always the agent now)
  const rawRecipientId = actionData.recipient_id || 
                        (actionData.action_payload && actionData.action_payload.recipient_id);
  
  const recipientName = actionData.recipient || 
                       (actionData.action_payload && actionData.action_payload.recipient) || 
                       "Project team";
  
  console.log("Resolving recipient contact ID...");
  console.log("Raw recipient ID:", rawRecipientId, "Recipient name:", recipientName);
  
  // Resolve recipient ID
  let recipientId: string | null = null;
  
  try {
    recipientId = await resolveContactId(supabase, rawRecipientId, recipientName, projectId, 'recipient');
    console.log("Resolved recipient ID:", recipientId);
  } catch (error) {
    console.error("Error resolving recipient ID:", error);
    recipientId = null;
  }
  
  // Additional validation to ensure we have valid UUID or null
  if (recipientId && !isValidUUID(recipientId)) {
    console.error("Recipient ID is not a valid UUID after resolution:", recipientId);
    recipientId = null;
  }

  // Prepare the action payload - agent is sender, no sender_ID (agent isn't a person)
  const actionPayload = {
    recipient: recipientName,
    sender: agentName,
    sender_type: 'agent',
    message_content: messageContent,
    recipient_id: recipientId,
    agent_phone: companyInfo.agentPhone
  };
  
  console.log("Creating message action with payload:", JSON.stringify(actionPayload));
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
        sender_ID: null, // Agent is not a person - no UUID
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
      recipientId,
      recipientIdValid: recipientId ? isValidUUID(recipientId) : 'null'
    });
    throw insertError;
  }
}
