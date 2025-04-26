
// Human-in-the-loop service for MCP handling

/**
 * Creates a human review request
 * 
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param promptRunId Prompt run ID that triggered the review
 * @param data Review request data
 * @returns ID of created human review request
 */
export async function createHumanReviewRequest(
  supabase: any,
  projectId: string,
  promptRunId: string,
  data: {
    reason: string;
    context: string;
    question?: string;
  }
): Promise<string | null> {
  try {
    console.log(`Creating human review request for project ${projectId}`);
    
    const { data: result, error } = await supabase
      .from('human_review_requests')
      .insert({
        project_id: projectId,
        prompt_run_id: promptRunId,
        review_reason: data.reason,
        context_data: data.context,
        question: data.question,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating human review request:", error);
      return null;
    }
    
    return result.id;
  } catch (error) {
    console.error("Error in createHumanReviewRequest:", error);
    return null;
  }
}
