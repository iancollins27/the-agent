
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

  return (data || []).map(run => ({
    ...run,
    pending_actions: run.action_records?.[0]?.count || 0
  })) as PromptRunWithPending[];
};
