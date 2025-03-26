
/**
 * Gets instructions for a specific milestone in a project track
 * @param supabase Supabase client
 * @param nextStep Milestone name
 * @param projectTrackId Project track ID
 * @returns Milestone instructions if found, null otherwise
 */
export async function getMilestoneInstructions(supabase: any, nextStep: string, projectTrackId: string | null) {
  if (!nextStep || !projectTrackId) {
    console.log('Missing required parameters:', { nextStep, projectTrackId });
    return null;
  }

  console.log('Fetching milestone instructions for:', {
    track_id: projectTrackId,
    step_title: nextStep
  });

  const { data: milestone, error } = await supabase
    .from('project_track_milestones')
    .select('prompt_instructions')
    .eq('track_id', projectTrackId)
    .eq('step_title', nextStep)
    .single();

  if (error) {
    console.error('Error fetching milestone instructions:', error);
    return null;
  }

  console.log('Found milestone:', milestone);
  return milestone ? milestone.prompt_instructions : null;
}

/**
 * Gets a workflow prompt template for summary generation or update
 * @param supabase Supabase client
 * @param isUpdate Whether the prompt is for updating an existing summary
 * @returns Prompt template text
 */
export async function getWorkflowPrompt(supabase: any, isUpdate: boolean) {
  const workflowType = isUpdate ? 'summary_update' : 'summary_generation';

  const { data: prompt, error } = await supabase
    .from('workflow_prompts')
    .select('prompt_text')
    .eq('type', workflowType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching workflow prompt:', error);
    throw new Error('Failed to get workflow prompt');
  }

  return prompt.prompt_text;
}
