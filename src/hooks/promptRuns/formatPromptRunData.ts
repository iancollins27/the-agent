
import { PromptRun } from '@/components/admin/types';

export const formatPromptRunData = (
  data: any[],
  rooferContactMap: Map<string, string>
): PromptRun[] => {
  return data.map(run => {
    const projectId = run.project_id;
    const rooferContact = projectId ? rooferContactMap.get(projectId) : null;
    
    return {
      ...run,
      project_name: run.projects?.crm_id || 'Unknown Project',
      project_address: run.projects?.Address || null,
      project_roofer_contact: rooferContact || null,
      workflow_prompt_type: run.workflow_prompts?.type || 'Unknown Type',
      workflow_type: run.workflow_prompts?.type,
      prompt_text: run.prompt_input,
      result: run.prompt_output,
      reviewed: run.reviewed === true
    } as PromptRun;
  });
};
