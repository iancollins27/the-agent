import { useState, useEffect } from 'react';
import { PromptRun } from '../components/admin/types';
import { usePromptFeedback } from './usePromptFeedback';
import { usePromptRunsFetcher } from './promptRuns/usePromptRunsFetcher';
import { UsePromptRunsProps } from './promptRuns/types';
import { supabase } from "@/integrations/supabase/client";

export const usePromptRuns = ({
  userProfile,
  statusFilter,
  onlyShowMyProjects,
  projectManagerFilter,
  timeFilter,
  getDateFilter,
  onlyShowLatestRuns = false,
  excludeReminderActions = false,
  onlyPendingActions = false
}: UsePromptRunsProps) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { handleRatingChange, handleFeedbackChange } = usePromptFeedback((updater) => {
    setPromptRuns(updater);
  });
  const { fetchPromptRuns: fetchData } = usePromptRunsFetcher();

  const fetchPromptRuns = async () => {
    if (!userProfile?.profile_associated_company) {
      console.warn('User has no profile_associated_company in profile, cannot fetch projects');
      setPromptRuns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // First, fetch prompt runs
      let formattedData: PromptRun[] = await fetchData(statusFilter);
      
      // Filter by project manager if selected
      if (projectManagerFilter && formattedData.length > 0) {
        const { data: projectsWithManager, error: projectsError } = await supabase
          .from('projects')
          .select('id')
          .eq('project_manager', projectManagerFilter);
        
        if (!projectsError && projectsWithManager) {
          const projectIds = new Set(projectsWithManager.map(p => p.id));
          formattedData = formattedData.filter(run => 
            run.project_id && projectIds.has(run.project_id)
          );
        }
      }

      // Apply the "only show my projects" filter if enabled
      if (onlyShowMyProjects && userProfile?.id && formattedData.length > 0) {
        const { data: myProjects, error: myProjectsError } = await supabase
          .from('projects')
          .select('id')
          .eq('project_manager', userProfile.id);
        
        if (!myProjectsError && myProjects) {
          const myProjectIds = new Set(myProjects.map(p => p.id));
          formattedData = formattedData.filter(run => 
            run.project_id && myProjectIds.has(run.project_id)
          );
        }
      }

      // Fetch company base URL for CRM links
      if (formattedData.length > 0) {
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('company_project_base_URL')
          .eq('id', userProfile.profile_associated_company)
          .single();
        
        if (!companyError && company && company.company_project_base_URL) {
          formattedData = formattedData.map(run => {
            if (run.project_name) {
              return {
                ...run,
                project_crm_url: `${company.company_project_base_URL}${run.project_name}`
              };
            }
            return run;
          });
        }
      }

      if (onlyShowLatestRuns === true && formattedData.length > 0) {
        const latestRunsByProject = new Map<string, PromptRun>();
        
        formattedData.forEach(run => {
          if (!run.project_id) return;
          
          const existingRun = latestRunsByProject.get(run.project_id);
          
          if (!existingRun || new Date(run.created_at) > new Date(existingRun.created_at)) {
            latestRunsByProject.set(run.project_id, run);
          }
        });
        
        formattedData = Array.from(latestRunsByProject.values());
        formattedData.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      if (excludeReminderActions && formattedData.length > 0) {
        const promptRunIds = formattedData.map(run => run.id);
        
        // Get all action records for these prompt runs
        const { data: actionData, error: actionError } = await supabase
          .from('action_records')
          .select('prompt_run_id, action_type, status')
          .in('prompt_run_id', promptRunIds);

        if (!actionError && actionData) {
          // Create a set of prompt run IDs that have at least one non-reminder pending action
          const promptRunsWithPendingActions = new Set<string>();
          
          // Group actions by prompt run ID
          const actionsByPromptRun = new Map<string, { hasOnlyReminders: boolean, hasAnyAction: boolean }>();
          
          // Initialize the map for each prompt run
          promptRunIds.forEach(runId => {
            actionsByPromptRun.set(runId, { hasOnlyReminders: true, hasAnyAction: false });
          });
          
          // Process each action record
          actionData.forEach(action => {
            if (!action.prompt_run_id) return;
            
            const runInfo = actionsByPromptRun.get(action.prompt_run_id);
            if (!runInfo) return;
            
            // Mark that this prompt run has at least one action
            runInfo.hasAnyAction = true;
            
            // If this is not a reminder/NO_ACTION and it's pending, add to the set of prompt runs to keep
            if (action.status === 'pending' && 
                action.action_type !== 'set_future_reminder' && 
                action.action_type !== 'NO_ACTION') {
              promptRunsWithPendingActions.add(action.prompt_run_id);
              // Also mark that this run doesn't have only reminders
              runInfo.hasOnlyReminders = false;
            }
          });
          
          // Filter to keep prompt runs that either:
          // 1. Have at least one non-reminder pending action, or
          // 2. Don't have any actions at all
          formattedData = formattedData.filter(run => 
            promptRunsWithPendingActions.has(run.id) || 
            !actionsByPromptRun.get(run.id)?.hasAnyAction
          );
        }
      }

      if (onlyPendingActions && formattedData.length > 0) {
        const promptRunIds = formattedData.map(run => run.id);
        
        const { data: actionData, error: actionError } = await supabase
          .from('action_records')
          .select('prompt_run_id')
          .in('prompt_run_id', promptRunIds)
          .eq('status', 'pending');

        if (!actionError && actionData) {
          const pendingActionRunIds = new Set(
            actionData.map(action => action.prompt_run_id)
          );
          
          formattedData = pendingActionRunIds.size > 0 
            ? formattedData.filter(run => pendingActionRunIds.has(run.id))
            : formattedData;
        }
      }

      setPromptRuns(formattedData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      console.log("Forcing a data refresh on component mount");
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
    onlyPendingActions
  ]);

  return {
    promptRuns,
    setPromptRuns,
    loading,
    handleRatingChange,
    handleFeedbackChange,
    fetchPromptRuns
  };
};
