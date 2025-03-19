
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
