
/**
 * Human-in-the-loop service
 * Handles requesting human reviews and escalations
 */

export async function requestHumanReview(
  supabase: any,
  projectId: string,
  promptRunId: string,
  reason: string,
  details: string
): Promise<{ id: string } | null> {
  try {
    console.log(`Requesting human review for project ${projectId}`);
    
    // Create an action record for the human review
    const { data, error } = await supabase
      .from('action_records')
      .insert({
        project_id: projectId,
        prompt_run_id: promptRunId,
        action_type: 'human_in_loop',
        status: 'pending',
        requires_approval: true,
        message: details,
        action_payload: {
          reason: reason,
          details: details,
          requested_at: new Date().toISOString(),
          prompt_run_id: promptRunId
        }
      })
      .select('id')
      .single();
    
    if (error) {
      console.error("Error creating human review action:", error);
      throw error;
    }
    
    console.log(`Created human review request with ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error("Error requesting human review:", error);
    return null;
  }
}

export async function resolveHumanReview(
  supabase: any,
  actionId: string,
  resolution: string,
  comments: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('action_records')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        message: comments,
        action_payload: {
          resolution: resolution,
          resolution_comments: comments,
          resolved_at: new Date().toISOString()
        }
      })
      .eq('id', actionId);
    
    if (error) {
      console.error("Error resolving human review:", error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Error resolving human review:", error);
    return false;
  }
}
