
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

export async function sendCommunication(): Promise<any> {
  toast.info("Outbound communications functionality has been disabled");
  return Promise.resolve({ disabled: true });
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
  toast.info("Notion integration functionality has been disabled");
  
  await supabase
    .from('action_records')
    .update({
      execution_result: {
        status: 'notion_integration_disabled',
        timestamp: new Date().toISOString(),
        details: 'Notion integration functionality has been disabled'
      }
    })
    .eq('id', actionId);
    
  return { disabled: true };
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
        // Instead of sending a communication, just record that it was disabled
        toast.info("Outbound communications functionality has been disabled");
        
        await supabase
          .from('action_records')
          .update({
            execution_result: {
              status: 'communication_disabled',
              timestamp: new Date().toISOString(),
              details: 'Outbound communications functionality has been disabled'
            }
          })
          .eq('id', action.id);
        break;
        
      case 'notion_integration':
        toast.info("Notion integration functionality has been disabled");
        
        await supabase
          .from('action_records')
          .update({
            execution_result: {
              status: 'notion_integration_disabled',
              timestamp: new Date().toISOString(),
              details: 'Notion integration functionality has been disabled'
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
