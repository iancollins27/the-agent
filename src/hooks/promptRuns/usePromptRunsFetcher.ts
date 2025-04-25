
import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from '@/components/admin/types';
import { fetchRooferContacts } from './useRooferContacts';
import { formatPromptRunData } from './formatPromptRunData';

export const usePromptRunsFetcher = () => {
  const { toast } = useToast();
  
  const fetchPromptRuns = async (statusFilter: string | null) => {
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

      if (data && data.length > 0) {
        const projectIds = data.map(run => run.project_id).filter(Boolean);
        const uniqueProjectIds = [...new Set(projectIds)];
        
        const rooferContactMap = await fetchRooferContacts(uniqueProjectIds);
        return formatPromptRunData(data, rooferContactMap);
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load prompt runs data",
      });
      return [];
    }
  };

  return { fetchPromptRuns };
};
