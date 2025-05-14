
import { supabase } from '@/integrations/supabase/client';

export const updateFeedbackReviewStatus = async (
  promptRunId: string,
  feedback: {
    feedback_review?: string | null;
    reviewed?: boolean;
  }
) => {
  const { error } = await supabase
    .from('prompt_runs')
    .update({
      feedback_review: feedback.feedback_review,
      reviewed: feedback.reviewed
    })
    .eq('id', promptRunId);

  if (error) {
    throw new Error(`Error updating feedback review: ${error.message}`);
  }

  return { success: true };
};
