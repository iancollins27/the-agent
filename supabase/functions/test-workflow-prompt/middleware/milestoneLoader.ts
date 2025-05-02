
/**
 * Middleware to load milestone instructions for a project
 */
export async function loadMilestoneInstructions(
  supabase: any, 
  contextData: any
): Promise<string | null> {
  if (!contextData.next_step) {
    return null;
  }
  
  try {
    const trackId = contextData.track_id;
    
    if (!trackId) {
      console.error('Missing track_id for milestone:', contextData.next_step);
      console.log('Missing projectTrackId parameter, cannot fetch milestone instructions for step:', contextData.next_step);
      return "No specific instructions available for this milestone step.";
    } else {
      // Fetch milestone instructions from the database
      const { data: milestone, error } = await supabase
        .from('project_track_milestones')
        .select('prompt_instructions')
        .eq('track_id', trackId)
        .eq('step_title', contextData.next_step)
        .single();

      if (error || !milestone) {
        console.log(`No milestone instructions found for step "${contextData.next_step}" with track_id: ${trackId}`);
        return "No specific instructions available for this milestone step.";
      } else {
        console.log(`Found milestone with step title: ${contextData.next_step}`);
        const instructions = milestone.prompt_instructions;
        console.log(`Instructions preview: ${instructions?.substring(0, 50)}...`);
        return instructions;
      }
    }
  } catch (error) {
    console.error('Error fetching milestone instructions:', error);
    return "No specific instructions available for this milestone step.";
  }
}
