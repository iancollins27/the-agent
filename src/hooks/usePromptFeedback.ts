import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '../components/admin/types';

export const usePromptFeedback = (
  updatePromptRuns: (updater: (prevRuns: PromptRun[]) => PromptRun[]) => void
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

  // Update the feedback parameter to be a string
  const handleFeedbackChange = async (promptRunId: string, feedback: string) => {
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({
          feedback_description: feedback
          // No longer updating feedback_tags
        })
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      updatePromptRuns(prev => 
        prev.map(run => 
          run.id === promptRunId 
            ? { 
                ...run, 
                feedback_description: feedback,
                // Keep existing tags 
                feedback_tags: run.feedback_tags
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
