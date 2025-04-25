
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from '@/components/admin/types';

export const fetchFilteredPromptRuns = async (
  projectIds: string[],
  statusFilter: string | null,
  timeConstraint: string | null,
  onlyPendingActions: boolean = false
) => {
  try {
    let query = supabase
      .from('prompt_runs')
      .select(`
        *,
        projects:project_id (crm_id, Address),
        workflow_prompts:workflow_prompt_id (type)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (timeConstraint) {
      query = query.gte('created_at', timeConstraint);
    }

    if (projectIds.length > 0) {
      query = query.in('project_id', projectIds);
    }

    let data = await query;
    
    if (onlyPendingActions && data.data) {
      // Fetch all prompt runs that have pending actions
      const { data: pendingActions } = await supabase
        .from('action_records')
        .select('prompt_run_id')
        .eq('status', 'pending');
      
      if (pendingActions) {
        const pendingPromptRunIds = new Set(pendingActions.map(action => action.prompt_run_id));
        data.data = data.data.filter(run => pendingPromptRunIds.has(run.id));
      }
    }

    if (data.error) {
      throw data.error;
    }

    return data.data || [];
  } catch (error) {
    console.error('Error in fetchFilteredPromptRuns:', error);
    return [];
  }
};
