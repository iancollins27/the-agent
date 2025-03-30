
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

    console.log("DEBUG: Approving action:", action.id, "with sender_ID:", action.sender_ID, "and sender_phone:", action.sender_phone);

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
      
      // Log Sender ID and phone
      console.log("DEBUG: Working with sender_ID in action record:", action.sender_ID);
      console.log("DEBUG: Working with sender_phone in action record:", action.sender_phone);
      
      // We need to make sure we have sender information
      let sender = undefined;
      
      // If we have sender_ID, fetch the sender details
      if (action.sender_ID) {
        console.log("DEBUG: Found sender_ID in action record:", action.sender_ID);
        
        const { data: senderData, error: senderError } = await supabase
          .from('contacts')
          .select('id, full_name, phone_number, email')
          .eq('id', action.sender_ID)
          .single();
          
        if (senderError) {
          console.error('Error fetching sender data:', senderError);
          console.log("DEBUG: Error details:", senderError.message, senderError.details, senderError.hint);
        } else if (senderData) {
          console.log("DEBUG: Successfully fetched sender data:", senderData);
          console.log("DEBUG: Sender phone_number:", senderData.phone_number);
          console.log("DEBUG: Sender email:", senderData.email);
          console.log("DEBUG: Sender full_name:", senderData.full_name);
          
          sender = {
            id: senderData.id,
            name: senderData.full_name,
            phone: senderData.phone_number || action.sender_phone, // Use sender_phone as fallback
            email: senderData.email
          };
          
          console.log("DEBUG: Constructed sender object:", sender);
        } else {
          console.log("DEBUG: Sender data not found for ID:", action.sender_ID);
          
          // If we can't find sender data but have sender_phone, create minimal sender object
          if (action.sender_phone) {
            sender = {
              phone: action.sender_phone
            };
            console.log("DEBUG: Created minimal sender with phone:", sender);
          }
        }
      } else if (action.sender_phone) {
        // If we only have sender_phone but no sender_ID
        console.log("DEBUG: No sender_ID found but have sender_phone:", action.sender_phone);
        sender = {
          phone: action.sender_phone
        };
        console.log("DEBUG: Created minimal sender with phone:", sender);
      } else {
        console.log("DEBUG: No sender_ID or sender_phone found in action record");
      }

      // Log the final request payload for debugging
      console.log("DEBUG: Sending communication with payload:", {
        actionId: action.id,
        messageContent,
        recipient,
        sender,
        channel,
        projectId: action.project_id
      });

      toast.info("Sending communication...");
      
      try {
        const { data, error } = await supabase.functions.invoke('send-communication', {
          body: {
            actionId: action.id,
            messageContent,
            recipient,
            sender, // This will include the phone if available
            channel,
            projectId: action.project_id
          }
        });
        
        if (error) {
          console.error("DEBUG: Error from send-communication function:", error);
          throw error;
        }
        
        console.log("DEBUG: Communication sent successfully, response:", data);
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
