
/**
 * Handler for human review action type
 */
import { HumanReviewActionParams } from '../types.ts';
import { validateRequiredParams } from '../../../utils/validation.ts';

export async function handleHumanReviewAction(
  supabase: any,
  promptRunId: string,
  projectId: string,
  actionData: HumanReviewActionParams
): Promise<{ action_record_id?: string, error?: string }> {
  try {
    // Validate required parameters
    const validation = validateRequiredParams(actionData, ['review_reason']);
    if (!validation.valid) {
      return { error: validation.errors.join(', ') };
    }
    
    // Create an action payload with the human review details
    const actionPayload = {
      review_reason: actionData.review_reason,
      description: actionData.description || `Human review requested: ${actionData.review_reason}`
    };
    
    console.log("Creating human review action with payload:", actionPayload);
    
    // Create the human review action record
    const { data, error } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'human_in_loop',
        action_payload: actionPayload,
        requires_approval: true,
        status: 'pending',
        message: actionData.review_reason
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating human review action record:", error);
      throw new Error(`Failed to create human review action: ${error.message}`);
    }
    
    console.log("Human review action record created successfully:", data);
    return { action_record_id: data.id };
  } catch (error) {
    console.error("Error in handleHumanReviewAction:", error);
    return { error: error.message || "Unknown error creating human review action" };
  }
}
