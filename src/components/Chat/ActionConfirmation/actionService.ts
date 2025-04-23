import { supabase } from "@/integrations/supabase/client";
import { ActionRecord } from "../types";
import { toast } from "sonner";

export async function updateActionStatus(
  actionId: string, 
  approve: boolean
): Promise<void> {
  const { error } = await supabase
    .from('action_records')
    .update({
      status: approve ? 'approved' : 'rejected',
      executed_at: approve ? new Date().toISOString() : null
    })
    .eq('id', actionId);
    
  if (error) {
    throw error;
  }
}

export async function updateProjectData(
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

export async function setProjectReminder(
  projectId: string,
  daysToAdd: number,
  checkReason: string,
  actionId: string
): Promise<void> {
  const nextCheckDate = new Date();
  nextCheckDate.setDate(nextCheckDate.getDate() + daysToAdd);
  
  const { error } = await supabase
    .from('projects')
    .update({
      next_check_date: nextCheckDate.toISOString()
    })
    .eq('id', projectId);
    
  if (error) {
    throw error;
  }
  
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

export async function sendCommunication(
  actionId: string,
  messageContent: string,
  recipient: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  },
  channel: 'sms' | 'email' | 'call',
  projectId?: string,
  companyId?: string,
  sender?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  }
): Promise<any> {
  console.log('Sending communication with data:', {
    actionId,
    messageContent,
    recipient,
    sender,
    channel,
    projectId,
    companyId
  });
  
  const { data, error } = await supabase.functions.invoke('send-communication', {
    body: {
      actionId,
      messageContent,
      recipient,
      sender,
      channel,
      projectId,
      companyId
    }
  });
  
  if (error) {
    console.error('Communication error:', error);
    throw new Error(`Communication error: ${error.message}`);
  }
  
  console.log('Communication sent successfully:', data);
  
  return data;
}

export async function recordCommunicationFailure(
  actionId: string, 
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('action_records')
    .update({
      execution_result: {
        status: 'communication_failed',
        timestamp: new Date().toISOString(),
        error: errorMessage
      }
    })
    .eq('id', actionId);
    
  if (error) {
    console.error('Error recording execution result:', error);
  }
}

export async function processNotionIntegration(
  actionId: string
): Promise<void> {
  await supabase
    .from('action_records')
    .update({
      execution_result: {
        status: 'notion_deprecated',
        timestamp: new Date().toISOString(),
        details: 'Notion integration has been deprecated.'
      },
      status: 'rejected'
    })
    .eq('id', actionId);
    
  throw new Error('Notion integration has been deprecated');
}

export async function getCompanyIdFromProject(projectId: string): Promise<string | null> {
  if (!projectId) return null;
  
  const { data, error } = await supabase
    .from('projects')
    .select('company_id')
    .eq('id', projectId)
    .maybeSingle();
  
  if (error || !data) {
    console.error('Error getting company ID:', error);
    return null;
  }
  
  return data.company_id;
}

export async function executeAction(action: ActionRecord): Promise<void> {
  if (!action) return;
  
  try {
    console.log('Executing action:', action);
    const actionPayload = action.action_payload as Record<string, any>;
    
    await updateActionStatus(action.id, true);
    
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
        const recipient = {
          id: action.recipient_id,
          name: action.recipient_name,
          phone: actionPayload.recipient_phone || actionPayload.phone,
          email: actionPayload.recipient_email || actionPayload.email
        };

        const sender = {
          id: action.sender_ID,
          name: action.sender_name,
          phone: action.sender?.phone_number || actionPayload.sender_phone || actionPayload.from,
          email: action.sender?.email || actionPayload.sender_email
        };

        let channel: 'sms' | 'email' | 'call' = 'sms';
        if (actionPayload.channel) {
          channel = actionPayload.channel as 'sms' | 'email' | 'call';
        } else if (recipient.email && !recipient.phone) {
          channel = 'email';
        }

        const messageContent = action.message || 
                              actionPayload.message_content || 
                              actionPayload.content || 
                              '';

        console.log('Preparing to send communication:', {
          actionId: action.id,
          messageContent,
          recipient,
          sender,
          channel,
          projectId: action.project_id
        });
                              
        toast.info("Sending communication...");
        
        try {
          await sendCommunication(
            action.id,
            messageContent,
            recipient,
            channel,
            action.project_id,
            actionPayload.company_id,
            sender
          );
          toast.success("Message sent successfully");
        } catch (commError: any) {
          console.error('Error sending communication:', commError);
          toast.error(commError.message || "Failed to send the message");
          await recordCommunicationFailure(action.id, commError.message || "Unknown error");
          throw commError;
        }
        break;
        
      case 'notion_integration':
        toast.error("Notion integration has been deprecated");
        await updateActionStatus(action.id, false);
        await supabase
          .from('action_records')
          .update({
            execution_result: {
              status: 'notion_deprecated',
              timestamp: new Date().toISOString(),
              details: 'Notion integration has been deprecated.'
            }
          })
          .eq('id', action.id);
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
    await updateActionStatus(actionId, false);
    toast.success("Action rejected successfully");
  } catch (error: any) {
    console.error('Error rejecting action:', error);
    toast.error(error.message || "Failed to reject action");
    throw error;
  }
}
