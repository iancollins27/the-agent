import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '../types';

export const usePromptRunActions = (
  setPromptRuns: React.Dispatch<React.SetStateAction<PromptRun[]>>,
  setSelectedRun: React.Dispatch<React.SetStateAction<PromptRun | null>>
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

      // Update local state to reflect the change
      setPromptRuns(prev => 
        prev.map(run => 
          run.id === promptRunId ? { ...run, feedback_rating: rating } : run
        )
      );

      // Update selected run if it's the one being rated
      setSelectedRun(prev => prev && prev.id === promptRunId ? { ...prev, feedback_rating: rating } : prev);

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

  // Update the type of the feedback parameter to match the expected interface
  const handleFeedbackChange = async (promptRunId: string, feedback: string) => {
    try {
      // Update feedback as a string in the database
      const { error } = await supabase
        .from('prompt_runs')
        .update({
          feedback_description: feedback,
          // We're no longer updating tags since feedback is now a string
        })
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      // Update local state to reflect the change
      setPromptRuns(prev => 
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

      // Update selected run if it's the one being modified
      setSelectedRun(prev => 
        prev && prev.id === promptRunId 
          ? { 
              ...prev, 
              feedback_description: feedback,
              // Keep existing tags
              feedback_tags: prev.feedback_tags
            } 
          : prev
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
