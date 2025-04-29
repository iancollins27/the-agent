
import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from '@/components/admin/types';
import { formatPromptRunData } from '@/utils/api/prompt-runs';

export const usePromptRunsFetcher = () => {
  const { toast } = useToast();
  
  const fetchPromptRuns = async (
    statusFilter: string | null,
    from: number = 0,
    to: number = 49  // Default to first 50 items
  ) => {
    try {
      console.log(`Fetching prompt runs with range ${from}-${to}`);
      
      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (crm_id, Address, next_step),
          workflow_prompts:workflow_prompt_id (type)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error in Supabase query:", error);
        throw error;
      }

      if (data && data.length > 0) {
        // Get formatted data first
        const formattedData = formatPromptRunData(data);
        
        // Return the formatted data without roofer contacts - we'll fetch those separately
        return formattedData;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load prompt runs data. The query might be too large.",
      });
      return [];
    }
  };

  return { fetchPromptRuns };
};
