import { PromptRun, WorkflowType } from "@/types/workflow";

/**
 * Formats the prompt run data to match the PromptRun type
 * @param promptRun The prompt run data from the database
 * @returns The formatted prompt run data
 */
export function formatPromptRunData(promptRun: any): PromptRun {
  const {
    id,
    created_at,
    status,
    ai_provider,
    ai_model,
    prompt_input,
    prompt_output,
    error_message,
    feedback_rating,
    feedback_description,
    feedback_tags,
    completed_at,
    reviewed,
    project_id,
    workflow_prompt_id,
    project_name,
    project_address,
    project_next_step,
    project_crm_url,
    project_roofer_contact,
    project_manager,
    prompt_tokens,
    completion_tokens,
    usd_cost
  } = promptRun;

  let workflow_type = promptRun.workflow_type || null;
  
  if (promptRun.workflow_prompts?.type) {
    workflow_type = promptRun.workflow_prompts.type;
  }

  return {
    id,
    created_at,
    status,
    ai_provider,
    ai_model,
    prompt_input,
    prompt_output,
    error_message,
    feedback_rating,
    feedback_description,
    feedback_tags,
    completed_at,
    reviewed,
    project_id,
    workflow_prompt_id,
    project_name,
    project_address,
    project_next_step,
    project_crm_url,
    project_roofer_contact,
    project_manager,
    prompt_tokens,
    completion_tokens,
    usd_cost,
    workflow_type
  };
}
