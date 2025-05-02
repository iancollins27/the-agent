
/**
 * Gets instructions for a specific milestone in a project track
 * @param supabase Supabase client
 * @param nextStep Milestone name
 * @param projectTrackId Project track ID
 * @returns Milestone instructions if found, null otherwise
 */
export async function getMilestoneInstructions(supabase: any, nextStep: string, projectTrackId: string | null) {
  if (!nextStep) {
    console.log('Missing next_step parameter, cannot fetch milestone instructions');
    return null;
  }
  
  if (!projectTrackId) {
    console.log('Missing projectTrackId parameter, cannot fetch milestone instructions for step:', nextStep);
    return null;
  }

  // Trim nextStep to prevent whitespace issues
  const trimmedStep = nextStep.trim();
  console.log('Fetching milestone instructions for:', {
    track_id: projectTrackId,
    step_title: trimmedStep,
    original_step_title: nextStep // Log original to check for whitespace
  });

  try {
    const { data: milestone, error } = await supabase
      .from('project_track_milestones')
      .select('prompt_instructions, step_title')
      .eq('track_id', projectTrackId)
      .eq('step_title', trimmedStep)
      .single();

    if (error) {
      console.error('Error fetching milestone instructions:', error);
      
      // Additional logging to help debug case sensitivity issues
      console.log('Trying case-insensitive search as fallback...');
      const { data: allMilestones } = await supabase
        .from('project_track_milestones')
        .select('id, step_title, prompt_instructions')
        .eq('track_id', projectTrackId);
      
      if (allMilestones && allMilestones.length > 0) {
        console.log('Available milestone steps for this track:', 
          allMilestones.map(m => `"${m.step_title}"`).join(', '));
          
        // Try a manual case-insensitive match
        const caseInsensitiveMatch = allMilestones.find(
          m => m.step_title && m.step_title.toLowerCase() === trimmedStep.toLowerCase()
        );
        
        if (caseInsensitiveMatch) {
          console.log('Found a case-insensitive match:', caseInsensitiveMatch.step_title);
          console.log('This suggests a case sensitivity issue in the data');
          return caseInsensitiveMatch.prompt_instructions;
        }
      } else {
        console.log('No milestones found for track ID:', projectTrackId);
      }
      
      return null;
    }

    if (milestone) {
      console.log('Found milestone with step title:', milestone.step_title);
      console.log('Instructions preview:', 
        milestone.prompt_instructions ? 
        (milestone.prompt_instructions.substring(0, 50) + 
         (milestone.prompt_instructions.length > 50 ? '...' : '')) : 
        'No instructions');
    } else {
      console.log('No milestone found with step title:', trimmedStep);
    }

    return milestone ? milestone.prompt_instructions : null;
  } catch (unexpectedError) {
    console.error('Unexpected error during milestone lookup:', unexpectedError);
    return null;
  }
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
