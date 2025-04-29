
import { PromptRun } from '@/components/admin/types';
import { WorkflowType, workflowTitles } from '@/types/workflow';

// Formats data from the database into the PromptRun format
export const formatPromptRunData = (data: any[]): PromptRun[] => {
  return data.map(run => {
    const baseUrl = run.projects?.companies?.company_project_base_URL || null;
    const crmId = run.projects?.crm_id || null;
    const crmUrl = baseUrl && crmId ? `${baseUrl}${crmId}` : null;
    
    // Ensure workflow_type is a valid value
    let workflowType = null;
    if (run.workflow_prompts?.type) {
      // Make sure it's a valid enum value
      if (Object.keys(workflowTitles).includes(run.workflow_prompts.type)) {
        workflowType = run.workflow_prompts.type;
      }
    }
    
    return {
      ...run,
      project_name: run.projects?.crm_id || 'Unknown Project',
      project_address: run.projects?.Address || null,
      project_crm_url: crmUrl,
      project_next_step: run.projects?.next_step || null,
      workflow_prompt_type: workflowType || 'Unknown Type',
      workflow_type: workflowType,
      prompt_text: run.prompt_input,
      result: run.prompt_output
    } as unknown as PromptRun;
  });
};
