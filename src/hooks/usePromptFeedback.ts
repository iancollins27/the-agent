
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { PromptRunUI } from '../types/prompt-run';

export const usePromptFeedback = (
  updatePromptRuns: (updater: (prevRuns: PromptRunUI[]) => PromptRunUI[]) => void
) => {
  const { toast } = useToast();
  
  const handleRatingChange = async (promptRunId: string, rating: number | null) => {
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({ feedback_rating: rating })
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      updatePromptRuns(prev => 
        prev.map(run => 
          run.id === promptRunId ? { ...run, feedback_rating: rating } : run
        )
      );

      toast({
        title: rating ? "Rating Updated" : "Rating Cleared",
        description: rating 
          ? "Prompt run rating has been updated successfully" 
          : "Prompt run rating has been cleared",
      });
    } catch (error) {
      console.error('Error updating rating:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update rating",
      });
    }
  };

  const handleFeedbackChange = async (promptRunId: string, feedback: { 
    description?: string; 
    tags?: string[];
    review?: string;
  }) => {
    try {
      // Create update data object
      const updateData: any = {
        feedback_description: feedback.description,
        feedback_tags: feedback.tags
      };
      
      if (feedback.review !== undefined) {
        updateData.feedback_review = feedback.review;
        // Set reviewed flag based on whether there's content in the review
        updateData.reviewed = feedback.review && feedback.review.trim().length > 0;
      }
      
      const { error } = await supabase
        .from('prompt_runs')
        .update(updateData)
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      updatePromptRuns(prev => 
        prev.map(run => 
          run.id === promptRunId 
            ? { 
                ...run, 
                feedback_description: feedback.description || null, 
                feedback_tags: feedback.tags || null,
                feedback_review: feedback.review !== undefined ? feedback.review : run.feedback_review,
                // Update the reviewed status based on review content
                reviewed: feedback.review !== undefined ? 
                  (feedback.review && feedback.review.trim().length > 0) : 
                  run.reviewed
              } 
            : run
        )
      );

      toast({
        title: "Feedback Updated",
        description: "Prompt run feedback has been updated successfully",
      });
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update feedback",
      });
    }
  };

  return {
    handleRatingChange,
    handleFeedbackChange
  };
};
