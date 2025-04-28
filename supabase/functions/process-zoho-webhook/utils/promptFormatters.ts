
/**
 * Utility functions for formatting prompts with variables
 */

/**
 * Format the workflow prompt with project data
 * @param promptTemplate Prompt template from the database
 * @param existingSummary Existing project summary
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
  const finalPrompt = promptTemplate
    .replace('{{summary}}', existingSummary)
    .replace('{{new_data}}', JSON.stringify(projectData))
    .replace('{{current_date}}', new Date().toISOString().split('T')[0])
    .replace('{{next_step_instructions}}', nextStepInstructions)
    .replace('{{track_roles}}', trackRoles || '')
    .replace('{{track_base_prompt}}', trackBasePrompt || '')
    .replace('{{track_name}}', trackName || '');

  // Log the final prompt string
  console.log('Final Workflow Prompt for Summary Generation:', finalPrompt);

  return finalPrompt;
}

/**
 * Format action detection prompt with variables
 * Similar to formatWorkflowPrompt but for action detection
 */
export function replaceActionPromptVariables(
  promptText: string,
  summary: string,
  trackName: string,
  trackRoles: string,
  trackBasePrompt: string,
  currentDate: string,
  nextStep: string,
  milestoneInstructions: string,
  propertyAddress: string = ''
) {
  const finalPrompt = promptText
    .replace('{{summary}}', summary)
    .replace('{{track_name}}', trackName || '')
    .replace('{{track_roles}}', trackRoles || '')
    .replace('{{track_base_prompt}}', trackBasePrompt || '')
    .replace('{{current_date}}', currentDate)
    .replace('{{next_step}}', nextStep || '')
    .replace('{{milestone_instructions}}', milestoneInstructions || '')
    .replace('{{property_address}}', propertyAddress || '');

  // Log the final prompt string
  console.log('Final Action Detection Prompt:', finalPrompt);

  return finalPrompt;
}
