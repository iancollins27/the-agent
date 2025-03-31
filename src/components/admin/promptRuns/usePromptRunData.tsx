
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
          projects:project_id (crm_id, Address),
          workflow_prompts:workflow_prompt_id (type)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Format data to include project and workflow information and properly cast to PromptRun type
      const formattedData = data.map(run => {
        return {
          ...run,
          project_name: run.projects?.crm_id || 'Unknown Project',
          project_address: run.projects?.Address || null,
          workflow_prompt_type: run.workflow_prompts?.type || 'Unknown Type',
          // Make sure it matches our PromptRun type
          workflow_type: run.workflow_prompts?.type,
          prompt_text: run.prompt_input,
          result: run.prompt_output,
          reviewed: run.reviewed || false
        } as unknown as PromptRun;
      });

      setPromptRuns(formattedData);
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

  // Fetch prompt runs when component mounts or statusFilter changes
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
