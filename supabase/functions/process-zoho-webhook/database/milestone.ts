
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

