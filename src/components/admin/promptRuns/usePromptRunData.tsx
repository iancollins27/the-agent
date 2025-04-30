import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '../types';

export const usePromptRunData = (statusFilter: string | null) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPromptRuns = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (
            crm_id, 
            Address,
            project_manager (
              id,
              profile_fname,
              profile_lname
            )
          ),
          workflow_prompts:workflow_prompt_id (id, type)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data) {
        const formattedRuns = data?.map(run => {
          // Get workflow type from the joined workflow_prompts table or from the run directly
          const workflowType = run.workflow_type || 
            (run.workflow_prompts ? run.workflow_prompts.type : null);
          
          // Format numeric values to ensure they're consistent
          let usdCost = run.usd_cost;
          if (typeof usdCost === 'string') {
            usdCost = parseFloat(usdCost);
          }
          
          return {
            ...run,
            id: run.id,
            created_at: run.created_at,
            project_name: run.projects?.crm_id || 'Unknown Project',
            project_address: run.projects?.Address || null,
            project_manager: run.projects?.project_manager ? 
              `${run.projects.project_manager.profile_fname || ''} ${run.projects.project_manager.profile_lname || ''}`.trim() || 'Unnamed Manager' 
              : null,
            workflow_type: workflowType,
            usd_cost: usdCost,
            prompt_text: run.prompt_input,
            result: run.prompt_output,
            reviewed: run.reviewed === true
          } as PromptRun;
        }) || [];

        setPromptRuns(formattedRuns);
      } else {
        setPromptRuns([]);
      }
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load prompt runs data",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromptRuns();
  }, [statusFilter]);

  return {
    promptRuns,
    setPromptRuns,
    loading,
    fetchPromptRuns
  };
};
