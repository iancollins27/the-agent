
import { PromptRun } from '@/components/admin/types';

export const formatPromptRunData = (
  data: any[]
): PromptRun[] => {
  return data.map(run => {    
    return {
      ...run,
      project_name: run.projects?.crm_id || 'Unknown Project',
      project_address: run.projects?.Address || null,
      workflow_prompt_type: run.workflow_prompts?.type || 'Unknown Type',
      workflow_type: run.workflow_prompts?.type,
      prompt_text: run.prompt_input,
      result: run.prompt_output,
      reviewed: run.reviewed === true,
      project_crm_url: null // This will be populated in usePromptRuns.ts
    } as PromptRun;
  });
};
