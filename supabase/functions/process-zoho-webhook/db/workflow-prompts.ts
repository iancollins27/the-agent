
/**
 * Functions for handling workflow prompts
 */
export async function getWorkflowPrompt(supabase: any, isUpdate: boolean) {
  const workflowType = isUpdate ? 'summary_update' : 'summary_generation';

  const { data: prompt, error } = await supabase
    .from('workflow_prompts')
    .select('prompt_text')
    .eq('type', workflowType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching workflow prompt:', error)
    throw new Error('Failed to get workflow prompt')
  }

  return prompt.prompt_text
}

/**
 * Get the action detection & execution prompt with reminder guidance
 */
export async function getActionDetectionPrompt(supabase: any) {
  const { data: prompt, error } = await supabase
    .from('workflow_prompts')
    .select('prompt_text')
    .eq('type', 'action_detection_execution')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching action detection prompt:', error)
    throw new Error('Failed to get action detection prompt')
  }

  // Add reminder guidance to the prompt if it's not already included
  let promptText = prompt.prompt_text;
  
  if (!promptText.includes('SET_FUTURE_REMINDER')) {
    promptText += `\n\nIn cases where no immediate action is needed but you should check back on this project later:
    
Your response must include:
{
  "decision": "SET_FUTURE_REMINDER",
  "reason": "Explanation of why we should check back later",
  "days_until_check": 3, // number of days until the next check should occur
  "check_reason": "Detailed reason for the future check",
  "action_type": "set_future_reminder"
}

This will create a reminder to automatically run this prompt again after the specified number of days. Use this when a milestone needs to be completed within a certain timeframe, but it's not yet overdue.`;
  }

  return promptText;
}
