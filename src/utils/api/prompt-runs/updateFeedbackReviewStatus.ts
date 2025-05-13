
import { supabase } from "@/integrations/supabase/client";

/**
 * Updates the reviewed status of all prompt runs based on whether they have content
 * in the feedback_review field.
 * @returns Promise with success/error information
 */
export const updateFeedbackReviewStatus = async () => {
  try {
    // Update prompt runs with feedback_review content
    const { error: withContentError } = await supabase
      .from('prompt_runs')
      .update({ reviewed: true })
      .is('feedback_review', null)
      .not('feedback_review', 'eq', '')
      .eq('reviewed', false);
    
    if (withContentError) {
      throw withContentError;
    }
    
    // Update prompt runs without feedback_review content
    const { error: withoutContentError } = await supabase
      .from('prompt_runs')
      .update({ reviewed: false })
      .or('feedback_review.is.null,feedback_review.eq.')
      .eq('reviewed', true);
      
    if (withoutContentError) {
      throw withoutContentError;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating feedback review status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};
