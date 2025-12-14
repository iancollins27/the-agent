
import { supabase } from "@/integrations/supabase/client";
import { ActionRecord } from "../types";
import { toast } from "@/components/ui/use-toast";

export async function executeAction(action: ActionRecord): Promise<void> {
  // First update the action status
  const { error } = await supabase
    .from('action_records')
    .update({
      status: 'approved',
      executed_at: new Date().toISOString()
    })
    .eq('id', action.id);

  if (error) throw error;
  
  // If it's a data update, update the project data
  if (action.action_type === 'data_update' && action.project_id) {
    const actionPayload = action.action_payload as Record<string, any>;
    const updateData = {
      [actionPayload.field]: actionPayload.value
    };
    
    const { error: updateError } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', action.project_id);
      
    if (updateError) {
      console.error('Error updating project:', updateError);
      toast({
        title: "Error",
        description: `Failed to update ${actionPayload.field}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: actionPayload.description || "Project updated successfully",
      });
    }
  } 
  // If it's a message, handle sending the message
  else if (action.action_type === 'message') {
    const actionPayload = action.action_payload as Record<string, any>;
    
    // Check if this is an agent message (sender_type === 'agent')
    const isAgentMessage = actionPayload.sender_type === 'agent';
    
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

    toast({
      title: "Sending Message",
      description: `Initiating ${isAgentMessage ? 'agent ' : ''}communication...`,
    });

    try {
      const { data, error } = await supabase.functions.invoke('send-communication', {
        body: {
          actionId: action.id,
          messageContent,
          recipient,
          channel,
          projectId: action.project_id,
          isAgentMessage, // Pass flag to use agent phone number
          agentPhone: actionPayload.agent_phone // Pass the agent phone if stored in payload
        }
      });
      
      if (error) {
        throw new Error(`Communication error: ${error.message}`);
      }
      
      toast({
        title: "Message Sent",
        description: `Communication successfully initiated`,
      });
      
    } catch (commError: any) {
      console.error('Error sending communication:', commError);
      toast({
        title: "Communication Failed",
        description: commError.message || "Failed to send the message",
        variant: "destructive",
      });
    }
  }
}

export async function rejectAction(actionId: string): Promise<void> {
  const { error } = await supabase
    .from('action_records')
    .update({
      status: 'rejected'
    })
    .eq('id', actionId);

  if (error) throw error;
  
  toast({
    title: "Action Rejected",
    description: "The proposed change was rejected",
  });
}
