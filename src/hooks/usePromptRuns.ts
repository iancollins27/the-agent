
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
      let formattedData = await fetchData(statusFilter);

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
        
        const { data: actionData, error: actionError } = await supabase
          .from('action_records')
          .select('prompt_run_id, action_type')
          .in('prompt_run_id', promptRunIds);

        if (!actionError && actionData) {
          const filteredActionRunIds = new Set(
            actionData
              .filter(action => 
                action.action_type === 'set_future_reminder' || 
                action.action_type === 'NO_ACTION'
              )
              .map(action => action.prompt_run_id)
          );

          formattedData = formattedData.filter(
            run => !filteredActionRunIds.has(run.id)
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
