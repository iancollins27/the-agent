
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
      // Extract data from action
      const actionPayload = action.action_payload as Record<string, any>;
      
      // Recipient information
      const recipient = {
        id: action.recipient_id,
        name: action.recipient_name,
        phone: actionPayload.recipient_phone || actionPayload.phone,
        email: actionPayload.recipient_email || actionPayload.email
      };

      // Communication channel
      const channel = actionPayload.channel || 'sms';
      
      // Message content
      const messageContent = action.message || 
                            actionPayload.message_content || 
                            actionPayload.content || 
                            '';
      
      // Sender information
      const sender = {
        id: action.sender_ID,
        name: action.sender_name,
        phone: actionPayload.sender_phone,
        email: actionPayload.sender_email
      };

      toast.info("Sending communication...");
      
      try {
        const { data, error } = await supabase.functions.invoke('send-communication', {
          body: {
            actionId: action.id,
            messageContent,
            recipient,
            sender,
            channel,
            projectId: action.project_id
          }
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
