
import { supabase } from "@/integrations/supabase/client";

export interface PromptRunWithPending extends Record<string, any> {
  id: string;
  created_at: string;
  pending_actions: number;
}

export const getPromptRunsWithPendingActions = async () => {
  const { data, error } = await supabase
    .from('prompt_runs')
    .select(`
      *,
      projects:project_id (crm_id, Address),
      workflow_prompts:workflow_prompt_id (type),
      action_records:id(count)
    `)
    .eq('action_records.status', 'pending')
    .throwOnError();

  if (error) {
    console.error('Error fetching prompt runs with pending actions:', error);
    throw error;
  }

  return (data || []).map(run => {
    // Get the count from the nested action_records array
    // The count field returned by Supabase could be of various types depending on the query
    let pendingActionsCount = 0;
    
    if (run.action_records && 
        run.action_records[0] && 
        run.action_records[0].count !== undefined) {
      // Convert the count to a number, regardless of the returned type
      pendingActionsCount = parseInt(String(run.action_records[0].count), 10);
    }
                              
    return {
      ...run,
      pending_actions: pendingActionsCount
    };
  }) as PromptRunWithPending[];
};
