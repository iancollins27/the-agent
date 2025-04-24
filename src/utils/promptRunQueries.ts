
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
      projects!prompt_runs_project_id_fkey(crm_id, Address),
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
        Array.isArray(run.action_records) && 
        run.action_records.length > 0) {
      // The count could be in different formats depending on the Supabase response
      const countValue = run.action_records[0];
      
      if (typeof countValue === 'object' && countValue !== null && 'count' in countValue) {
        // Handle object with count property
        pendingActionsCount = parseInt(String(countValue.count), 10) || 0;
      } else if (typeof countValue === 'number') {
        // Handle direct number value
        pendingActionsCount = countValue;
      } else if (typeof countValue === 'string') {
        // Handle string value that might represent a number
        pendingActionsCount = parseInt(countValue, 10) || 0;
      }
    }
                              
    return {
      ...run,
      pending_actions: pendingActionsCount
    };
  }) as PromptRunWithPending[];
};
