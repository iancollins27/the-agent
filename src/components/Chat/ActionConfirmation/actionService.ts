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
  senderId?: string
): Promise<any> {
  console.log('Sending communication with data:', {
    actionId,
    messageContent,
    recipient,
    channel,
    projectId,
    companyId,
    senderId
  });
  
  // If we have a senderId, fetch the sender contact details to include in the request
  let senderInfo = {};
  if (senderId) {
    const { data: senderData, error: senderError } = await supabase
      .from('contacts')
      .select('id, full_name, phone_number, email')
      .eq('id', senderId)
      .single();
      
    if (!senderError && senderData) {
      console.log('Found sender data:', senderData);
      senderInfo = {
        senderId: senderData.id,
        sender: {
          id: senderData.id,
          name: senderData.full_name,
          phone: senderData.phone_number,
          phone_number: senderData.phone_number,
          email: senderData.email
        },
        sender_phone: senderData.phone_number
      };
    } else {
      console.error('Error fetching sender data:', senderError);
    }
  }
  
  const { data, error } = await supabase.functions.invoke('send-communication', {
    body: {
      actionId,
      messageContent,
      recipient: {
        ...recipient,
        ...senderInfo
      },
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
  actionId: string,
  companyId: string | null,
  notionToken: string,
  notionDatabaseId?: string,
  notionPageId?: string
): Promise<any> {
  const { data, error } = await supabase.functions.invoke('process-notion-integration', {
    body: { 
      companyId,
      notionToken,
      notionDatabaseId,
      notionPageId
    }
  });
  
  if (error) {
    throw error;
  }
  
  await supabase
    .from('action_records')
    .update({
      execution_result: {
        status: 'notion_integration_started',
        timestamp: new Date().toISOString(),
        details: data
      }
    })
    .eq('id', actionId);
    
  return data;
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

        const senderId = action.sender_ID || 
                        actionPayload.sender_id || 
                        actionPayload.senderId;

        console.log('Preparing to send communication:', {
          actionId: action.id,
          messageContent,
          recipient,
          channel,
          projectId: action.project_id,
          senderId
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
            senderId
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
        const companyId = await getCompanyIdFromProject(action.project_id || '');
        await processNotionIntegration(
          action.id,
          companyId,
          actionPayload.notion_token,
          actionPayload.notion_database_id,
          actionPayload.notion_page_id
        );
        toast.success("Notion integration started. Content will be processed in the background.");
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
