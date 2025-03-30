
import { supabase } from "@/integrations/supabase/client";
import { ActionRecord } from "@/components/Chat/types";
import { toast } from "sonner";

/**
 * Approves an action and executes it if it's a message action
 */
export const handleApproveAction = async (action: ActionRecord): Promise<void> => {
  try {
    if (!action) {
      throw new Error("Action not found");
    }

    // First update the action status
    const { error } = await supabase
      .from('action_records')
      .update({
        status: 'approved',
        executed_at: new Date().toISOString()
      })
      .eq('id', action.id);

    if (error) throw error;
    
    // If it's a message action, also send the communication
    if (action.action_type === 'message') {
      const actionPayload = action.action_payload as Record<string, any>;
      
      // Prepare recipient data - consistent approach
      const recipient = {
        id: action.recipient_id,
        name: action.recipient_name || 
             (action.recipient ? action.recipient.full_name : null) ||
             (actionPayload && typeof actionPayload === 'object' ? actionPayload.recipient : null),
        phone: (action.recipient ? action.recipient.phone_number : null) || 
              (actionPayload && typeof actionPayload === 'object' ? actionPayload.recipient_phone || actionPayload.phone : null),
        email: (action.recipient ? action.recipient.email : null) || 
              (actionPayload && typeof actionPayload === 'object' ? actionPayload.recipient_email || actionPayload.email : null)
      };

      // Prepare sender data - using same approach as recipient for consistency
      const sender = {
        id: action.sender_ID,
        name: action.sender_name ||
             (action.sender ? action.sender.full_name : null) ||
             (actionPayload && typeof actionPayload === 'object' ? actionPayload.sender : null),
        phone: (action.sender ? action.sender.phone_number : null) ||
              (actionPayload && typeof actionPayload === 'object' ? actionPayload.sender_phone : null),
        email: (action.sender ? action.sender.email : null) ||
              (actionPayload && typeof actionPayload === 'object' ? actionPayload.sender_email : null)
      };

      console.log("Prepared sender data:", sender);

      // Determine communication channel based on available recipient data
      let channel: 'sms' | 'email' | 'call' = 'sms'; // Default to SMS
      if (actionPayload && typeof actionPayload === 'object' && actionPayload.channel) {
        channel = actionPayload.channel as 'sms' | 'email' | 'call';
      } else if (recipient.email && !recipient.phone) {
        channel = 'email';
      }

      // Get message content from appropriate field
      const messageContent = action.message || 
                            (actionPayload && typeof actionPayload === 'object' ? actionPayload.message_content || actionPayload.content : '') ||
                            '';

      toast.info("Sending communication...");
      
      // Log the full payload for debugging
      const payload = {
        actionId: action.id,
        messageContent,
        recipient,
        sender,
        channel,
        projectId: action.project_id
      };
      console.log("Sending payload to send-communication:", payload);
      
      try {
        const { data, error } = await supabase.functions.invoke('send-communication', {
          body: payload
        });
        
        if (error) {
          throw error;
        }
        
        toast.success("Communication sent successfully");
      } catch (commError) {
        console.error('Error sending communication:', commError);
        toast.error("Failed to send communication");
      }
    }
    
    toast.success("Action approved successfully");
    return Promise.resolve();
  } catch (error) {
    console.error('Error approving action:', error);
    toast.error("Failed to approve action");
    return Promise.reject(error);
  }
};

/**
 * Rejects an action
 */
export const handleRejectAction = async (actionId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('action_records')
      .update({
        status: 'rejected'
      })
      .eq('id', actionId);

    if (error) throw error;
    
    toast.success("Action rejected successfully");
    return Promise.resolve();
  } catch (error) {
    console.error('Error rejecting action:', error);
    toast.error("Failed to reject action");
    return Promise.reject(error);
  }
};
