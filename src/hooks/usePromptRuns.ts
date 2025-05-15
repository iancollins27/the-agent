
import { useState, useEffect } from 'react';
import { PromptRunUI } from '../types/prompt-run';
import { usePromptFeedback } from './usePromptFeedback';
import { usePromptRunsFetcher } from './promptRuns/usePromptRunsFetcher';
import { UsePromptRunsProps } from './promptRuns/types';
import { supabase } from "@/integrations/supabase/client";
import { PromptRunWithRoofer } from '@/utils/api/prompt-runs/types';

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
  const [promptRuns, setPromptRuns] = useState<PromptRunUI[]>([]);
  const [loading, setLoading] = useState(true);
  const { handleRatingChange, handleFeedbackChange } = usePromptFeedback((updater) => {
    setPromptRuns(prevRuns => {
      // Ensure we're updating PromptRunUI[] with another PromptRunUI[]
      return updater(prevRuns as any) as PromptRunUI[];
    });
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
      let formattedData = await fetchData(statusFilter);
      
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

      // Find only latest runs if requested
      if (onlyShowLatestRuns === true && formattedData.length > 0) {
        const latestRunsByProject = new Map<string, PromptRunWithRoofer>();
        
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

      // Filter reminder actions
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

      // Filter to only pending actions
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

      // Map the data to the UI model
      const uiPromptRuns: PromptRunUI[] = formattedData.map(run => {
        return {
          id: run.id,
          created_at: run.created_at,
          status: run.status || '',
          ai_provider: run.ai_provider || '',
          ai_model: run.ai_model || '',
          prompt_input: run.prompt_input || '',
          prompt_output: run.prompt_output || '',
          error_message: run.error_message || null,
          feedback_rating: run.feedback_rating || null,
          feedback_description: run.feedback_description || null,
          feedback_tags: run.feedback_tags || null,
          feedback_review: run.feedback_review || null,
          completed_at: run.completed_at || null,
          reviewed: run.reviewed || false,
          project_id: run.project_id || null,
          workflow_prompt_id: run.workflow_prompt_id || null,
          workflow_prompt_type: run.workflow_prompt_type || null,
          project_name: run.project_name || null,
          project_address: run.project_address || null,
          project_next_step: run.project_next_step || null,
          project_crm_url: run.project_crm_url || null,
          project_roofer_contact: run.project_roofer_contact || null,
          project_manager: run.project_manager || null,
          relative_time: run.relative_time || '',
          workflow_type: run.workflow_type || null,
          error: !!run.error_message,
          toolLogsCount: run.toolLogsCount || 0
        };
      });

      setPromptRuns(uiPromptRuns);
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
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
