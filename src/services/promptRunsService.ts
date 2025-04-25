
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from '@/components/admin/types';

export const fetchFilteredPromptRuns = async (
  projectIds: string[],
  statusFilter: string | null,
  timeConstraint: string | null
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

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchFilteredPromptRuns:', error);
    return [];
  }
};

