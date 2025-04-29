
import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '../types';

export const usePromptRunData = (statusFilter: string | null) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchPromptRunsCount = useCallback(async () => {
    try {
      let query = supabase
        .from('prompt_runs')
        .select('id', { count: 'exact', head: true });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { count, error } = await query;

      if (error) {
        console.error("Error counting prompt runs:", error);
        return null;
      }

      return count;
    } catch (error) {
      console.error('Error counting prompt runs:', error);
      return null;
    }
  }, [statusFilter]);

  const fetchPromptRuns = useCallback(async () => {
    setLoading(true);
    
    try {
      // First get the total count
      const count = await fetchPromptRunsCount();
      setTotalCount(count);
      
      // Now fetch the actual data
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
          workflow_prompts:workflow_prompt_id (type)
        `)
        .order('created_at', { ascending: false })
        .range(0, 49);  // Get first 50 items initially

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data) {
        // Format the data
        const formattedData = data.map(run => ({
          ...run,
          id: run.id,
          created_at: run.created_at,
          project_name: run.projects?.crm_id || 'Unknown Project',
          project_address: run.projects?.Address || null,
          project_manager: run.projects?.project_manager ? 
            `${run.projects.project_manager.profile_fname || ''} ${run.projects.project_manager.profile_lname || ''}`.trim() || 'Unnamed Manager' 
            : null,
          workflow_type: run.workflow_prompts?.type,
          prompt_text: run.prompt_input,
          result: run.prompt_output,
          reviewed: run.reviewed === true
        })) as PromptRun[];

        setPromptRuns(formattedData);
      } else {
        setPromptRuns([]);
      }
    } catch (error: any) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load prompt runs data: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast, fetchPromptRunsCount]);

  useEffect(() => {
    fetchPromptRuns();
  }, [fetchPromptRuns]);

  return {
    promptRuns,
    setPromptRuns,
    loading,
    fetchPromptRuns,
    totalCount
  };
};
