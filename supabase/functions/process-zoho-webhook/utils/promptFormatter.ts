
/**
 * Format the workflow prompt with project data
 * @param promptTemplate Prompt template from the database
 * @param existingSummary Existing project summary if available
 * @param projectData Parsed project data
 * @param nextStepInstructions Instructions for the next milestone
 * @param trackRoles Track roles
 * @param trackBasePrompt Track base prompt
 * @param trackName Track name
 * @returns Formatted prompt
 */
export function formatWorkflowPrompt(
  promptTemplate: string, 
  existingSummary: string,
  projectData: any,
  nextStepInstructions: string,
  trackRoles: string,
  trackBasePrompt: string,
  trackName: string
) {
  return promptTemplate
    .replace('{{summary}}', existingSummary)
    .replace('{{new_data}}', JSON.stringify(projectData))
    .replace('{{current_date}}', new Date().toISOString().split('T')[0])
    .replace('{{next_step_instructions}}', nextStepInstructions)
    .replace('{{track_roles}}', trackRoles || '')
    .replace('{{track_base_prompt}}', trackBasePrompt || '')
    .replace('{{track_name}}', trackName || '');
}
