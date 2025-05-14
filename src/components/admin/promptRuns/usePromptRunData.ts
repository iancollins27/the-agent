
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PromptRun } from '../types';

export interface UsePromptRunDataProps {
  projectId?: string;
  timeFilter: string;
  activeTab: string;
  filters: {
    reviewed: boolean;
    rating: number | null;
    hasError: boolean;
    search: string;
  };
}

// Define a type for project data
interface ProjectData {
  id?: string;
  Address?: string;
  project_name?: string;
}

export const usePromptRunData = ({ projectId, timeFilter, activeTab, filters }: UsePromptRunDataProps) => {
  const [data, setData] = useState<PromptRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Function to get date filter based on timeFilter
  const getDateFilter = () => {
    const now = new Date();
    let dateFilter = null;

    switch (timeFilter) {
      case '24h':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFilter = yesterday.toISOString();
        break;
      case '7d':
        const lastWeek = new Date(now);
        lastWeek.setDate(lastWeek.getDate() - 7);
        dateFilter = lastWeek.toISOString();
        break;
      case '30d':
        const lastMonth = new Date(now);
        lastMonth.setDate(lastMonth.getDate() - 30);
        dateFilter = lastMonth.toISOString();
        break;
      case '90d':
        const lastQuarter = new Date(now);
        lastQuarter.setDate(lastQuarter.getDate() - 90);
        dateFilter = lastQuarter.toISOString();
        break;
      default:
        dateFilter = null;
    }

    return dateFilter;
  };

  // Fetch prompt runs data
  const { data: queryData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['promptRuns', projectId, timeFilter, activeTab, JSON.stringify(filters)],
    queryFn: async () => {
      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          project:project_id (
            id,
            Address,
            project_name
          ),
          tool_logs:tool_logs(count)
        `);
      
      // Apply date filter if needed
      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
      
      // Apply project filter if specified
      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      // Apply status filter based on activeTab
      if (activeTab === 'success') {
        query = query.eq('status', 'SUCCESS');
      } else if (activeTab === 'error') {
        query = query.eq('status', 'ERROR');
      }

      // Apply additional filters
      if (filters.reviewed) {
        query = query.eq('reviewed', true);
      }
      
      if (filters.rating !== null) {
        query = query.eq('feedback_rating', filters.rating);
      }
      
      if (filters.hasError) {
        query = query.not('error_message', 'is', null);
      }
      
      if (filters.search) {
        query = query.or(`prompt_input.ilike.%${filters.search}%,prompt_output.ilike.%${filters.search}%`);
      }
      
      // Order by created_at in descending order
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
  
  // Process the data when it arrives
  useEffect(() => {
    if (queryLoading) {
      setIsLoading(true);
      return;
    }
    
    if (queryError) {
      setError(queryError instanceof Error ? queryError : new Error('An error occurred fetching data'));
      setIsLoading(false);
      return;
    }
    
    if (queryData) {
      try {
        // Process the data
        const processedData = queryData.map(run => {
          // Handle the project object safely with nullish coalescing
          const project = (run.project || {}) as ProjectData;
          
          return {
            id: run.id,
            created_at: run.created_at,
            status: run.status || 'unknown',
            project_id: run.project_id,
            project_name: project.project_name,
            project_address: project.Address,
            workflow_prompt_type: run.workflow_prompt_type,
            workflow_type: null, // This might need to be derived from workflow_prompt_type
            error: !!run.error_message,
            error_message: run.error_message,
            reviewed: run.reviewed || false,
            project_crm_url: null, // No crm_url field in project
            toolLogsCount: run.tool_logs?.length || 0,
            ai_provider: run.ai_provider || 'unknown',
            ai_model: run.ai_model || 'unknown',
            prompt_input: run.prompt_input || '',
            prompt_output: run.prompt_output || '',
            feedback_rating: run.feedback_rating,
            feedback_description: run.feedback_description,
            feedback_tags: run.feedback_tags,
            feedback_review: run.feedback_review,
            completed_at: run.completed_at,
            workflow_prompt_id: run.workflow_prompt_id
          } as PromptRun;
        });
        
        setData(processedData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error processing data'));
      }
      
      setIsLoading(false);
    }
  }, [queryData, queryLoading, queryError]);
  
  // Function to manually refresh data
  const refresh = () => {
    refetch();
  };
  
  return { data, isLoading, error, refresh };
};
