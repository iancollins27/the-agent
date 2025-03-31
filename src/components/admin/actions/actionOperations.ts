
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
    
    // If it's a message action, mark it as approved but don't send anything
    if (action.action_type === 'message') {
      toast.info("Communications functionality has been disabled.");
      
      // Record that we didn't actually send the communication
      await supabase
        .from('action_records')
        .update({
          execution_result: {
            status: 'disabled',
            timestamp: new Date().toISOString(),
            details: 'Outbound communications functionality has been disabled'
          }
        })
        .eq('id', action.id);
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
