
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Sends a human review request
 */
export async function sendHumanReviewRequest(data: {
  projectId: string;
  promptRunId: string | null;
  reviewerEmail: string;
  content: string;
  reason: string;
  requestedBy: string;
}): Promise<string> {
  try {
    const { data: requestData, error } = await supabase
      .from('human_review_requests')
      .insert({
        project_id: data.projectId,
        prompt_run_id: data.promptRunId,
        reviewer_email: data.reviewerEmail,
        content: data.content,
        reason: data.reason,
        requested_by: data.requestedBy,
        status: 'PENDING'
      })
      .select('id')
      .single();

    if (error) throw error;
    
    return requestData.id;
  } catch (error) {
    console.error('Error sending human review request:', error);
    throw new Error(`Failed to create human review request: ${error.message}`);
  }
}
