
import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '../components/admin/types';
import { TIME_FILTERS } from "./useTimeFilter";
import { usePromptFeedback } from './usePromptFeedback';
import { supabase } from "@/integrations/supabase/client";
import { 
  debugProjectData, 
  fetchProjects, 
  fetchFilteredPromptRuns, 
  formatPromptRunData 
} from '@/utils/promptRunsApi';

interface UsePromptRunsProps {
  userProfile: any;
  statusFilter: string | null;
  onlyShowMyProjects: boolean;
  projectManagerFilter: string | null;
  timeFilter: string;
  getDateFilter: () => string | null;
  onlyShowLatestRuns?: boolean;
  excludeReminderActions?: boolean;
  page?: number;
  pageSize?: number;
}

export const usePromptRuns = ({
  userProfile,
  statusFilter,
  onlyShowMyProjects,
  projectManagerFilter,
  timeFilter,
  getDateFilter,
  onlyShowLatestRuns = false,
  excludeReminderActions = false,
  page = 1,
  pageSize = 20
}: UsePromptRunsProps) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { handleRatingChange, handleFeedbackChange } = usePromptFeedback(setPromptRuns);

  useEffect(() => {
    if (userProfile) {
      fetchPromptRuns();
    }
  }, [
    statusFilter, 
    userProfile, 
    onlyShowMyProjects, 
    projectManagerFilter, 
    timeFilter, 
    onlyShowLatestRuns,
    excludeReminderActions,
    page,
    pageSize
  ]);

  const fetchPromptRuns = async () => {
    if (!userProfile?.profile_associated_company) {
      console.warn('User has no profile_associated_company in profile, cannot fetch projects');
      setPromptRuns([]);
      setLoading(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Your user profile is not associated with a company",
      });
      return;
    }

    setLoading(true);
    try {
      const companyId = userProfile.profile_associated_company;
      
      await debugProjectData(companyId);
      
      const projectsData = await fetchProjects(
        companyId, 
        userProfile.id, 
        onlyShowMyProjects,
        projectManagerFilter
      );
      
      if (projectsData.length === 0) {
        setPromptRuns([]);
        setLoading(false);
        return;
      }

      const projectIds = projectsData.map(project => project.id);
      
      const timeConstraint = timeFilter !== TIME_FILTERS.ALL ? getDateFilter() : null;
      
      // Calculate the range for pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Add range parameter to the fetchFilteredPromptRuns call
      const data = await fetchFilteredPromptRuns(
        projectIds, 
        statusFilter, 
        timeConstraint,
        from,
        to
      );
      
      // Use the formatted data from the utility function
      let formattedData = formatPromptRunData(data);

      console.log(`Total prompt runs before filtering: ${formattedData.length}`);

      // Initialize pending_actions with default value to avoid undefined
      formattedData = formattedData.map(run => ({
        ...run,
        pending_actions: run.pending_actions || 0
      }));

      if (onlyShowLatestRuns === true && formattedData.length > 0) {
        console.log("Filtering to show only latest runs per project");
        
        const latestRunsByProject = new Map<string, PromptRun>();
        
        formattedData.forEach(run => {
          if (!run.project_id) {
            console.log(`Skipping run ${run.id} with no project_id`);
            return;
          }
          
          const existingRun = latestRunsByProject.get(run.project_id);
          
          if (!existingRun || new Date(run.created_at) > new Date(existingRun.created_at)) {
            latestRunsByProject.set(run.project_id, run);
          }
        });
        
        const latestRuns = Array.from(latestRunsByProject.values());
        
        latestRuns.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        console.log(`Total prompt runs after filtering for latest only: ${latestRuns.length}`);
        
        // Update formattedData with the latest runs only
        formattedData = latestRuns;
      } else {
        console.log(`Showing all ${formattedData.length} runs`);
      }

      // Fetch pending actions for all prompt runs
      if (formattedData.length > 0) {
        const promptRunIds = formattedData.map(run => run.id);
        
        if (promptRunIds.length > 0) {
          const { data: actionData, error: actionError } = await supabase
            .from('action_records')
            .select('prompt_run_id')
            .eq('status', 'pending')
            .in('prompt_run_id', promptRunIds);
          
          if (!actionError && actionData) {
            // Count occurrences of each prompt_run_id
            const pendingActionCounts = new Map<string, number>();
            
            actionData.forEach(action => {
              const currentCount = pendingActionCounts.get(action.prompt_run_id) || 0;
              pendingActionCounts.set(action.prompt_run_id, currentCount + 1);
            });
            
            // Update the pending_actions count for each run
            formattedData = formattedData.map(run => ({
              ...run,
              pending_actions: pendingActionCounts.get(run.id) || 0
            }));
            
            console.log("Added pending action counts to prompt runs");
          } else if (actionError) {
            console.error('Error fetching pending actions:', actionError);
          }
        }
      }

      // Apply filtering for excluding reminder actions if needed
      if (excludeReminderActions && formattedData.length > 0) {
        const promptRunIds = formattedData.map(run => run.id);
        
        if (promptRunIds.length > 0) {
          const { data: actionData, error: actionError } = await supabase
            .from('action_records')
            .select('prompt_run_id, action_type')
            .in('prompt_run_id', promptRunIds);
  
          if (actionError) {
            console.error('Error fetching action records:', actionError);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to filter out reminder actions",
            });
          } else if (actionData) {
            const filteredActionRunIds = new Set(
              actionData
                .filter(action => 
                  action.action_type === 'set_future_reminder' || 
                  action.action_type === 'NO_ACTION'
                )
                .map(action => action.prompt_run_id)
            );
  
            // Filter out reminder actions
            formattedData = formattedData.filter(run => !filteredActionRunIds.has(run.id));
            
            console.log(`Total prompt runs after filtering reminders and NO_ACTION: ${formattedData.length}`);
          }
        }
      }
      
      setPromptRuns(formattedData);
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load prompt runs data",
      });
      setPromptRuns([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    promptRuns,
    setPromptRuns,
    loading,
    handleRatingChange,
    handleFeedbackChange,
    fetchPromptRuns
  };
};
