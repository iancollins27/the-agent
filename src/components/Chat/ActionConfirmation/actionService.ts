
import { supabase } from "@/integrations/supabase/client";
import { ActionRecord } from "../types";
import { toast } from "sonner";

export async function executeAction(action: ActionRecord): Promise<void> {
  if (!action) return;
  
  try {
    console.log('Executing action:', action);
    const actionPayload = action.action_payload as Record<string, any>;
    
    // Update the action status to approved
    const { error } = await supabase
      .from('action_records')
      .update({
        status: 'approved',
        executed_at: new Date().toISOString()
      })
      .eq('id', action.id);
        
    if (error) {
      throw error;
    }
    
    // Handle different action types
    switch (action.action_type) {
      case 'data_update':
        if (action.project_id) {
          await updateProjectData(
            action.project_id, 
            actionPayload.field, 
            actionPayload.value
          );
          toast.success(actionPayload.description || "Project updated successfully");
        }
        break;
        
      case 'set_future_reminder':
        if (action.project_id) {
          const daysToAdd = actionPayload.days_until_check || 7;
          await setProjectReminder(
            action.project_id, 
            daysToAdd, 
            actionPayload.check_reason || '', 
            action.id
          );
          toast.success(`Reminder set to check this project again in ${daysToAdd} days`);
        }
        break;
        
      case 'message':
        // Prepare recipient data
        const recipient = {
          id: action.recipient_id,
          name: action.recipient_name,
          phone: actionPayload.recipient_phone || actionPayload.phone,
          email: actionPayload.recipient_email || actionPayload.email
        };

        // Get message content
        const messageContent = action.message || 
                              actionPayload.message_content || 
                              actionPayload.content || 
                              '';
                              
        toast.info("Sending communication...");
        
        try {
          const { data, error } = await supabase.functions.invoke('send-communication', {
            body: {
              actionId: action.id,
              messageContent,
              recipient,
              channel: 'sms',
              projectId: action.project_id
            }
          });
          
          if (error) {
            throw error;
          }
          
          toast.success("Message sent successfully");
        } catch (commError: any) {
          console.error('Error sending communication:', commError);
          toast.error(commError.message || "Failed to send the message");
          throw commError;
        }
        break;
        
      default:
        toast.success("Action approved successfully");
    }
  } catch (error: any) {
    console.error('Error executing action:', error);
    toast.error(error.message || "Failed to execute action");
    throw error;
  }
}

export async function rejectAction(actionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('action_records')
      .update({
        status: 'rejected'
      })
      .eq('id', actionId);
      
    if (error) {
      throw error;
    }
    
    toast.success("Action rejected successfully");
  } catch (error: any) {
    console.error('Error rejecting action:', error);
    toast.error(error.message || "Failed to reject action");
    throw error;
  }
}

async function updateProjectData(
  projectId: string,
  field: string,
  value: any
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      [field]: value
    })
    .eq('id', projectId);
    
  if (error) {
    throw error;
  }
}

async function setProjectReminder(
  projectId: string,
  daysToAdd: number,
  checkReason: string,
  actionId: string
): Promise<void> {
  // Calculate the next check date based on days_until_check
  const nextCheckDate = new Date();
  nextCheckDate.setDate(nextCheckDate.getDate() + daysToAdd);
  
  // Update the project with the next check date
  const { error } = await supabase
    .from('projects')
    .update({
      next_check_date: nextCheckDate.toISOString()
    })
    .eq('id', projectId);
    
  if (error) {
    throw error;
  }
  
  // Record the execution result
  await supabase
    .from('action_records')
    .update({
      execution_result: {
        status: 'reminder_set',
        timestamp: new Date().toISOString(),
        next_check_date: nextCheckDate.toISOString(),
        details: `Reminder set to check in ${daysToAdd} days: ${checkReason || 'No reason provided'}`
      }
    })
    .eq('id', actionId);
}
