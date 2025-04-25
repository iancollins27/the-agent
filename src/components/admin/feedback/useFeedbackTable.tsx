
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from '../types';
import { toast } from "@/components/ui/use-toast";

export const useFeedbackTable = () => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedbackData = async () => {
    try {
      // The issue is with the OR filter syntax - let's fix it
      const { data, error } = await supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (
            crm_id,
            Address,
            companies:company_id (
              company_project_base_URL
            )
          )
        `)
        .or('feedback_rating.is.not.null,feedback_description.is.not.null,feedback_tags.is.not.null'.replaceAll(',', ','))
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formattedData = data.map(run => {
        const baseUrl = run.projects?.companies?.company_project_base_URL;
        const crmId = run.projects?.crm_id;
        return {
          ...run,
          project_name: run.projects?.crm_id || 'Unknown Project',
          project_address: run.projects?.Address || null,
          project_crm_url: baseUrl && crmId ? `${baseUrl}${crmId}` : null,
        } as PromptRun;
      });

      setPromptRuns(formattedData);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load feedback data",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbackData();
  }, []);

  return { promptRuns, loading };
};
