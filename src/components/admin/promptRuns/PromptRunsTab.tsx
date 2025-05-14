
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { supabase } from "@/integrations/supabase/client";

// Component imports
import PromptRunsTable from './PromptRunsTable';
import EmptyPromptRunsState from './EmptyPromptRunsState';
import TimeFilterSelect from '../TimeFilterSelect';
import PromptRunHeader from './PromptRunHeader';
import PromptRunFilters from './PromptRunFilters';

// Hooks and utils
import { useTimeFilter } from '@/hooks/useTimeFilter';
import { useFilterPersistence } from '@/hooks/useFilterPersistence';
import { PromptRunWithRoofer } from '@/utils/api/prompt-runs/types';

// Define the filter structure
interface PromptRunFiltersState {
  reviewed: boolean;
  rating: number | null;
  hasError: boolean;
  search: string;
}

const PromptRunsTab = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState('all');
  
  // Get time filter state
  const { timeFilter, setTimeFilter } = useTimeFilter();
  
  // Set up persisted filter state with proper typing
  const { filters: storedFilters, updateFilter } = useFilterPersistence<PromptRunFiltersState>('promptRunsFilters', {
    reviewed: false,
    rating: null,
    hasError: false,
    search: '',
  });
  
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
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['promptRuns', projectId, timeFilter, activeTab, JSON.stringify(storedFilters)],
    queryFn: async () => {
      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (
            id,
            Address,
            project_name
          ),
          workflow_prompts:workflow_prompt_id (type),
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
      if (storedFilters.reviewed) {
        query = query.eq('reviewed', true);
      }
      
      if (storedFilters.rating !== null) {
        query = query.eq('feedback_rating', storedFilters.rating);
      }
      
      if (storedFilters.hasError) {
        query = query.not('error_message', 'is', null);
      }
      
      if (storedFilters.search) {
        query = query.or(`prompt_input.ilike.%${storedFilters.search}%,prompt_output.ilike.%${storedFilters.search}%`);
      }
      
      // Order by created_at in descending order
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Process the data
      return data.map(run => {
        // Handle the project object safely
        const project = run.projects || {};
        // Extract workflow type from workflow prompts
        const workflowType = run.workflow_prompts?.type || null;
        
        return {
          id: run.id,
          created_at: run.created_at,
          status: run.status || 'unknown',
          ai_provider: run.ai_provider || 'unknown',
          ai_model: run.ai_model || 'unknown',
          prompt_input: run.prompt_input || '',
          prompt_output: run.prompt_output || '',
          error_message: run.error_message,
          feedback_rating: run.feedback_rating,
          feedback_description: run.feedback_description,
          feedback_tags: run.feedback_tags,
          feedback_review: run.feedback_review,
          completed_at: run.completed_at,
          reviewed: run.reviewed || false,
          project_id: run.project_id,
          workflow_prompt_id: run.workflow_prompt_id,
          workflow_prompt_type: workflowType,
          project_name: project.project_name,
          project_address: project.Address,
          project_next_step: null, // Not in current data structure
          project_crm_url: null, // Will be added later if available
          project_roofer_contact: null, // Will be added later
          project_manager: null, // Will be added later
          relative_time: formatRelativeTime(run.created_at),
          workflow_type: workflowType,
          error: !!run.error_message,
          toolLogsCount: run.tool_logs?.length || 0
        } as PromptRunWithRoofer;
      });
    }
  });
  
  // Helper function to format relative time
  const formatRelativeTime = (dateString: string): string => {
    const now = new Date();
    const promptDate = new Date(dateString);
    const diffMs = now.getTime() - promptDate.getTime();

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  React.useEffect(() => {
    if (error) {
      toast({
        title: "Error Loading Data",
        description: error.message || "Failed to load prompt runs. Please try again.",
        variant: "destructive",
      });
    }
  }, [error]);
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="w-full">
      {/* Header with project info if viewing a single project */}
      {projectId && data && data.length > 0 && (
        <PromptRunHeader 
          projectName={data[0]?.project_name || data[0]?.project_address || 'Unnamed Project'}
          onBackClick={() => navigate('/admin/prompt-runs')}
        />
      )}
      
      {/* Filters row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
          <TimeFilterSelect 
            value={timeFilter}
            onChange={setTimeFilter}
          />
          
          <PromptRunFilters
            setFilter={updateFilter}
            reviewed={storedFilters.reviewed}
            rating={storedFilters.rating}
            hasError={storedFilters.hasError}
            search={storedFilters.search}
          />
        </div>
        
        {/* Tabs for execution status */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full md:w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="success">Successful</TabsTrigger>
            <TabsTrigger value="error">Errors</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Content */}
      <TabsContent value={activeTab} className="mt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="w-full h-16 rounded-md" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <PromptRunsTable data={data} refresh={refetch} />
        ) : (
          <EmptyPromptRunsState 
            filters={storedFilters}
            timeFilter={timeFilter}
            onResetFilters={() => {
              updateFilter('rating', null);
              updateFilter('reviewed', false);
              updateFilter('hasError', false);
              updateFilter('search', '');
              setTimeFilter('24h');
            }}
          />
        )}
      </TabsContent>
    </div>
  );
};

export default PromptRunsTab;
