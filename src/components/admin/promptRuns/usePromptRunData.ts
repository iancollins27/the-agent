
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UsePromptRunDataProps {
  projectId?: string;
  timeFilter: string;
  filters: {
    reviewed: boolean;
    rating: number | null;
    hasError: boolean;
    search: string;
  };
  activeTab: string;
}

export const usePromptRunData = ({ 
  projectId, 
  timeFilter, 
  filters,
  activeTab 
}: UsePromptRunDataProps) => {
  const [timeFilterDate, setTimeFilterDate] = useState<string | null>(null);
  
  // Convert time filter to date
  useEffect(() => {
    const now = new Date();
    
    if (timeFilter === 'last_hour') {
      const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
      setTimeFilterDate(oneHourAgo.toISOString());
    } else if (timeFilter === 'last_24_hours' || timeFilter === '24h') {
      const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      setTimeFilterDate(oneDayAgo.toISOString());
    } else if (timeFilter === 'last_7_days' || timeFilter === '7d') {
      const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      setTimeFilterDate(oneWeekAgo.toISOString());
    } else {
      setTimeFilterDate(null);
    }
  }, [timeFilter]);

  // Build the query for fetching prompt runs data
  const promptRunsQuery = useQuery({
    queryKey: ['promptRuns', projectId, timeFilterDate, filters, activeTab],
    queryFn: async () => {
      try {
        // Use explicitly joined select with FK fields specified
        let query = supabase
          .from('prompt_runs')
          .select(`
            id,
            created_at,
            project_id,
            status,
            error_message,
            reviewed,
            ai_provider,
            ai_model,
            prompt_input,
            prompt_output,
            workflow_prompt_id,
            project:project_id (
              id,
              project_name,
              Address,
              crm_id,
              crm_url
            )
          `)
          .order('created_at', { ascending: false });

        // Apply project filter if provided
        if (projectId) {
          query = query.eq('project_id', projectId);
        }

        // Apply time filter if provided
        if (timeFilterDate) {
          query = query.gte('created_at', timeFilterDate);
        }

        // Apply reviewed filter
        if (filters.reviewed) {
          query = query.eq('reviewed', true);
        }

        // Apply error filter
        if (filters.hasError) {
          query = query.not('error_message', 'is', null);
        }
        
        // Apply tab filter
        if (activeTab === 'success') {
          query = query.is('error_message', null);
        } else if (activeTab === 'error') {
          query = query.not('error_message', 'is', null);
        }

        // Execute query
        const { data, error } = await query;

        if (error) {
          throw new Error(`Error fetching prompt runs: ${error.message}`);
        }

        if (!data) {
          return [];
        }

        // Process the data
        return data.map(run => {
          // Handle the project object safely with nullish coalescing
          const project = run.project || {};
          
          return {
            id: run.id,
            status: run.status,
            ai_provider: run.ai_provider,
            ai_model: run.ai_model,
            prompt_input: run.prompt_input,
            prompt_output: run.prompt_output,
            created_at: run.created_at,
            project_id: run.project_id,
            project_name: project?.project_name || null,
            project_address: project?.Address || null,
            workflow_prompt_type: null, // Not available in the current schema
            workflow_type: null, // Not available in the current schema
            error: !!run.error_message,
            error_message: run.error_message,
            reviewed: run.reviewed || false,
            project_crm_url: project?.crm_url || null
          };
        });
      } catch (error) {
        console.error('Error in usePromptRunData:', error);
        throw error;
      }
    }
  });

  return {
    data: promptRunsQuery.data || [],
    isLoading: promptRunsQuery.isLoading,
    error: promptRunsQuery.error as Error | null,
    refresh: promptRunsQuery.refetch
  };
};
