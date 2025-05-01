
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { findContactId } from "../utils/contactUtils.ts";

/**
 * Handle other action types with improved error handling
 */
export async function handleOtherActionTypes(
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
      return { 
        status: "error", 
        error: `Failed to create action record: ${error.message}`
      };
    }
    
    console.log("Action record created successfully:", data);
    return { 
      status: "success", 
      action_record_id: data.id,
      message: "Action record created successfully"
    };
  } catch (insertError) {
    console.error("Exception during action record insert:", insertError);
    return { 
      status: "error", 
      error: insertError.message || "Unknown error during action creation"
    };
  }
}
