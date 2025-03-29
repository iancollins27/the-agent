
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

/**
 * Execute a specific action based on its type
 * @param supabase Supabase client
 * @param actionId Action ID to execute
 */
export async function executeSpecificAction(supabase: any, actionId: string): Promise<any> {
  console.log(`Executing specific action with ID: ${actionId}`);
  
  try {
    // Fetch the action record
    const { data: action, error: actionError } = await supabase
      .from('action_records')
      .select('*')
      .eq('id', actionId)
      .single();
      
    if (actionError || !action) {
      console.error('Error fetching action record:', actionError);
      return { success: false, error: 'Action record not found' };
    }
    
    console.log(`Processing action of type: ${action.action_type}`);
    
    // Process based on action type
    if (action.action_type === 'message') {
      return await executeMessageAction(supabase, action);
    } else {
      console.log(`Action type ${action.action_type} doesn't require special execution`);
      return { success: true, message: 'No special execution needed for this action type' };
    }
  } catch (error) {
    console.error('Error executing specific action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute a message action by sending the communication
 * @param supabase Supabase client
 * @param action Action record
 */
async function executeMessageAction(supabase: any, action: any): Promise<any> {
  console.log(`Executing message action ID: ${action.id}`);
  
  try {
    // Extract action payload
    const actionPayload = action.action_payload || {};
    
    // Prepare recipient data
    const recipient = {
      id: action.recipient_id,
      name: action.recipient_name || actionPayload.recipient,
      phone: actionPayload.recipient_phone || actionPayload.phone,
      email: actionPayload.recipient_email || actionPayload.email
    };

    // Determine communication channel based on available recipient data
    let channel: 'sms' | 'email' | 'call' = 'sms'; // Default to SMS
    if (actionPayload.channel) {
      channel = actionPayload.channel as 'sms' | 'email' | 'call';
    } else if (recipient.email && !recipient.phone) {
      channel = 'email';
    }

    // Get message content from appropriate field
    const messageContent = action.message || 
                           actionPayload.message_content || 
                           actionPayload.content || 
                           '';
                           
    if (!messageContent) {
      return { success: false, error: 'No message content found' };
    }
    
    console.log(`Sending ${channel} to ${recipient.name || recipient.id} with message: ${messageContent.substring(0, 50)}...`);
    
    // Call the send-communication function to deliver the message
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-communication', {
      body: {
        actionId: action.id,
        messageContent,
        recipient,
        channel,
        projectId: action.project_id
      }
    });
    
    if (sendError) {
      console.error('Error sending communication:', sendError);
      return { success: false, error: sendError.message };
    }
    
    console.log('Communication sent successfully:', sendResult);
    
    // Update action record with execution result
    const { error: updateError } = await supabase
      .from('action_records')
      .update({
        execution_result: {
          status: 'message_sent',
          timestamp: new Date().toISOString(),
          channel: channel,
          details: sendResult
        }
      })
      .eq('id', action.id);
      
    if (updateError) {
      console.error('Error updating action execution result:', updateError);
    }
    
    return { success: true, message: 'Communication sent successfully', details: sendResult };
  } catch (error) {
    console.error('Error executing message action:', error);
    return { success: false, error: error.message };
  }
}
