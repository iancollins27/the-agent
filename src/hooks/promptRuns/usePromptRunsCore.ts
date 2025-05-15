
import { useState, useEffect } from 'react';
import { PromptRunUI } from '@/types/prompt-run';
import { usePromptRunsFetcher } from './usePromptRunsFetcher';
import { usePromptRunActions } from './usePromptRunActions';
import { usePromptRunFilters } from './usePromptRunFilters';
import { UsePromptRunsProps } from './types';

export const usePromptRunsCore = ({
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
  
  const { fetchPromptRuns: fetchData } = usePromptRunsFetcher();
  const { handleRatingChange, handleFeedbackChange } = usePromptRunActions(setPromptRuns);
  const { applyFilters } = usePromptRunFilters();

  const fetchPromptRuns = async () => {
    if (!userProfile?.company_id) {
      console.warn('User has no company_id in profile, cannot fetch projects');
      setPromptRuns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // First, fetch prompt runs
      let formattedData = await fetchData(statusFilter);
      
      // Apply all filters
      formattedData = await applyFilters({
        data: formattedData,
        userProfile,
        projectManagerFilter,
        onlyShowMyProjects,
        onlyShowLatestRuns,
        excludeReminderActions,
        onlyPendingActions
      });

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
