
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
}

export const usePromptRuns = ({
  userProfile,
  statusFilter,
  onlyShowMyProjects,
  projectManagerFilter,
  timeFilter,
  getDateFilter,
  onlyShowLatestRuns = false,
  excludeReminderActions = false
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
    excludeReminderActions
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
      
      const data = await fetchFilteredPromptRuns(projectIds, statusFilter, timeConstraint);
      
      let formattedData = formatPromptRunData(data);

      console.log(`Total prompt runs before filtering: ${formattedData.length}`);
      console.log(`onlyShowLatestRuns is set to: ${onlyShowLatestRuns}`);

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
        
        formattedData = Array.from(latestRunsByProject.values());
        
        formattedData.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        console.log(`Total prompt runs after filtering for latest only: ${formattedData.length}`);
      } else {
        console.log(`Skipping latest runs filter, showing all ${formattedData.length} runs`);
      }

      if (excludeReminderActions && formattedData.length > 0) {
        const promptRunIds = formattedData.map(run => run.id);
        
        // Get all action records for these prompt runs
        const { data: actionData, error: actionError } = await supabase
          .from('action_records')
          .select('prompt_run_id, action_type, action_payload')
          .in('prompt_run_id', promptRunIds);

        if (actionError) {
          console.error('Error fetching action records:', actionError);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to filter out reminder actions",
          });
        } else {
          console.log('Action records fetched:', actionData.length);
          
          // Debug log - check what action types we have
          const actionTypes = new Set(actionData.map(action => action.action_type));
          console.log('Action types found:', Array.from(actionTypes));
          
          // Create a map to track which prompt runs should be excluded
          const excludedPromptRunIds = new Set();
          
          // Identify prompt runs with reminder actions or NO_ACTION
          actionData.forEach(action => {
            // Debug individual action records to see what's happening
            console.log(`Action record for run ${action.prompt_run_id}: type=${action.action_type}`);
            
            // Check action_type directly
            if (
              action.action_type === 'set_future_reminder' || 
              action.action_type === 'NO_ACTION'
            ) {
              excludedPromptRunIds.add(action.prompt_run_id);
            }
            
            // Also check inside action_payload for any no action indicators
            if (action.action_payload) {
              const payload = action.action_payload;
              if (
                (typeof payload === 'object' && 
                 payload !== null && 
                 'action_type' in payload && 
                 (payload.action_type === 'NO_ACTION'))
              ) {
                console.log(`Found NO_ACTION in payload for run ${action.prompt_run_id}`);
                excludedPromptRunIds.add(action.prompt_run_id);
              }
            }
          });
          
          console.log(`Number of prompt runs to exclude: ${excludedPromptRunIds.size}`);
          
          // Also identify prompt runs with no action records (no actions needed)
          const runsWithActions = new Set(actionData.map(action => action.prompt_run_id));
          
          // Get runs without any actions
          const runsWithoutActions = promptRunIds.filter(id => !runsWithActions.has(id));
          console.log(`Runs without any action records: ${runsWithoutActions.length}`);
          
          // Add runs without any actions to excluded set
          runsWithoutActions.forEach(id => excludedPromptRunIds.add(id));

          // Filter out excluded runs
          const originalCount = formattedData.length;
          formattedData = formattedData.filter(run => !excludedPromptRunIds.has(run.id));
          
          console.log(`Filtered runs: ${originalCount} → ${formattedData.length} (${excludedPromptRunIds.size} excluded)`);
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
