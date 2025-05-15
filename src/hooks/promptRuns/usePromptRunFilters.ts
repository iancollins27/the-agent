
import { supabase } from "@/integrations/supabase/client";
import { PromptRunWithRoofer } from '@/utils/api/prompt-runs/types';

type FilterParams = {
  data: PromptRunWithRoofer[];
  userProfile: any;
  projectManagerFilter: string | null;
  onlyShowMyProjects: boolean;
  onlyShowLatestRuns: boolean;
  excludeReminderActions: boolean;
  onlyPendingActions: boolean;
};

export const usePromptRunFilters = () => {
  const applyFilters = async ({
    data,
    userProfile,
    projectManagerFilter,
    onlyShowMyProjects,
    onlyShowLatestRuns,
    excludeReminderActions,
    onlyPendingActions
  }: FilterParams): Promise<PromptRunWithRoofer[]> => {
    let filteredData = [...data];

    // Filter by project manager if selected
    if (projectManagerFilter && filteredData.length > 0) {
      const { data: projectsWithManager, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('project_manager', projectManagerFilter);
      
      if (!projectsError && projectsWithManager) {
        const projectIds = new Set(projectsWithManager.map(p => p.id));
        filteredData = filteredData.filter(run => 
          run.project_id && projectIds.has(run.project_id)
        );
      }
    }

    // Apply the "only show my projects" filter if enabled
    if (onlyShowMyProjects && userProfile?.id && filteredData.length > 0) {
      const { data: myProjects, error: myProjectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('project_manager', userProfile.id);
      
      if (!myProjectsError && myProjects) {
        const myProjectIds = new Set(myProjects.map(p => p.id));
        filteredData = filteredData.filter(run => 
          run.project_id && myProjectIds.has(run.project_id)
        );
      }
    }

    // Fetch company base URL for CRM links
    if (filteredData.length > 0) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('company_project_base_URL')
        .eq('id', userProfile.company_id)
        .single();
      
      if (!companyError && company && company.company_project_base_URL) {
        filteredData = filteredData.map(run => {
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

    // Find only latest runs if requested
    if (onlyShowLatestRuns === true && filteredData.length > 0) {
      const latestRunsByProject = new Map<string, PromptRunWithRoofer>();
      
      filteredData.forEach(run => {
        if (!run.project_id) return;
        
        const existingRun = latestRunsByProject.get(run.project_id);
        
        if (!existingRun || new Date(run.created_at) > new Date(existingRun.created_at)) {
          latestRunsByProject.set(run.project_id, run);
        }
      });
      
      filteredData = Array.from(latestRunsByProject.values());
      filteredData.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    // Apply action-related filters
    if ((excludeReminderActions || onlyPendingActions) && filteredData.length > 0) {
      filteredData = await filterByActionRecords(filteredData, excludeReminderActions, onlyPendingActions);
    }

    return filteredData;
  };

  const filterByActionRecords = async (
    data: PromptRunWithRoofer[], 
    excludeReminderActions: boolean,
    onlyPendingActions: boolean
  ): Promise<PromptRunWithRoofer[]> => {
    const promptRunIds = data.map(run => run.id);
    
    // Get all action records for these prompt runs
    const { data: actionData, error: actionError } = await supabase
      .from('action_records')
      .select('prompt_run_id, action_type, status')
      .in('prompt_run_id', promptRunIds);

    if (actionError || !actionData) {
      console.error('Error fetching action records:', actionError);
      return data;
    }

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

    let result = [...data];

    // Filter to exclude reminder actions
    if (excludeReminderActions) {
      // Filter to keep prompt runs that either:
      // 1. Have at least one non-reminder pending action, or
      // 2. Don't have any actions at all
      result = result.filter(run => 
        promptRunsWithPendingActions.has(run.id) || 
        !actionsByPromptRun.get(run.id)?.hasAnyAction
      );
    }

    // Filter to only show pending actions
    if (onlyPendingActions) {
      result = promptRunsWithPendingActions.size > 0 
        ? result.filter(run => promptRunsWithPendingActions.has(run.id))
        : result;
    }

    return result;
  };

  return { applyFilters };
};
