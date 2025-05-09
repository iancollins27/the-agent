
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseKey);

interface IntegrationJobParams {
  companyId: string;
  projectId?: string;
  actionRecordId?: string;
  operationType: 'read' | 'write' | 'delete';
  resourceType: 'project' | 'task' | 'note' | 'contact' | 'communication';
  payload: Record<string, any>;
  status?: string;
  scheduledTime?: Date;
}

/**
 * Creates a new integration job in the queue
 */
export async function createIntegrationJob(params: IntegrationJobParams): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('integration_job_queue')
      .insert({
        company_id: params.companyId,
        project_id: params.projectId || null,
        action_record_id: params.actionRecordId || null,
        operation_type: params.operationType,
        resource_type: params.resourceType,
        payload: params.payload,
        status: params.status || 'pending',
        next_retry_at: params.scheduledTime ? params.scheduledTime.toISOString() : null
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error creating integration job:", error);
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error("Error creating integration job:", error);
    return null;
  }
}

/**
 * Gets jobs from the queue that match the given criteria
 */
export async function getIntegrationJobs(
  status: string = 'pending',
  limit: number = 10
): Promise<any[]> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('integration_job_queue')
      .select('*')
      .eq('status', status)
      .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(limit);
      
    if (error) {
      console.error("Error fetching integration jobs:", error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error("Error fetching integration jobs:", error);
    return [];
  }
}

/**
 * Updates the status of an integration job
 */
export async function updateIntegrationJobStatus(
  jobId: string,
  status: string,
  result: any = null,
  errorMessage: string | null = null,
  incrementRetry: boolean = false
): Promise<boolean> {
  try {
    const updates: any = { status };
    
    if (status === 'completed' || status === 'failed') {
      updates.processed_at = new Date().toISOString();
    }
    
    if (result !== null) {
      updates.result = result;
    }
    
    if (errorMessage !== null) {
      updates.error_message = errorMessage;
    }
    
    // Handle retry logic
    if (incrementRetry) {
      // First get current retry count
      const { data: jobData } = await supabase
        .from('integration_job_queue')
        .select('retry_count')
        .eq('id', jobId)
        .single();
        
      const retryCount = (jobData?.retry_count || 0) + 1;
      updates.retry_count = retryCount;
      
      // Exponential backoff for retries: 1min, 5min, 15min, 30min, 1hr, 2hr, 4hr, 8hr
      const backoffMinutes = Math.min(2 ** (retryCount - 1), 480);
      const nextRetry = new Date();
      nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);
      updates.next_retry_at = nextRetry.toISOString();
      updates.status = 'retry';
    }
    
    const { error } = await supabase
      .from('integration_job_queue')
      .update(updates)
      .eq('id', jobId);
      
    if (error) {
      console.error("Error updating integration job:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error updating integration job:", error);
    return false;
  }
}
