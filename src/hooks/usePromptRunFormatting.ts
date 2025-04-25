
import { PromptRun } from '@/components/admin/types';

export const usePromptRunFormatting = () => {
  const formatPromptRunData = (data: any[]): PromptRun[] => {
    return data.map(run => ({
      id: run.id,
      project_id: run.project_id,
      workflow_prompt_id: run.workflow_prompt_id,
      prompt_input: run.prompt_input,
      prompt_output: run.prompt_output,
      error_message: run.error_message,
      status: run.status,
      created_at: run.created_at,
      completed_at: run.completed_at,
      feedback_rating: run.feedback_rating,
      feedback_description: run.feedback_description,
      feedback_tags: run.feedback_tags,
      project_name: run.projects?.crm_id || 'Unknown Project',
      project_address: run.projects?.Address || null,
      workflow_type: run.workflow_prompts?.type || 'Unknown Type',
      reviewed: run.reviewed === true,
      ai_provider: run.ai_provider,
      ai_model: run.ai_model,
      project_roofer_contact: null // This will be populated by the parent component if needed
    }));
  };

  return { formatPromptRunData };
};

