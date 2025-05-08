
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

  const handleFeedbackChange = async (promptRunId: string, feedback: { 
    description?: string; 
    tags?: string[]; 
    review?: string;
  }) => {
    try {
      // If review is being updated, automatically mark as reviewed
      const updateData: any = {
        feedback_description: feedback.description,
        feedback_tags: feedback.tags
      };
      
      if (feedback.review !== undefined) {
        updateData.feedback_review = feedback.review;
        // Set reviewed flag to true when providing a review
        updateData.reviewed = feedback.review ? true : null;
      }
      
      const { error } = await supabase
        .from('prompt_runs')
        .update(updateData)
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
                feedback_description: feedback.description || null, 
                feedback_tags: feedback.tags || null,
                feedback_review: feedback.review !== undefined ? feedback.review : run.feedback_review,
                reviewed: feedback.review ? true : run.reviewed
              } 
            : run
        )
      );

      // Update selected run if it's the one being modified
      setSelectedRun(prev => 
        prev && prev.id === promptRunId 
          ? { 
              ...prev, 
              feedback_description: feedback.description || null, 
              feedback_tags: feedback.tags || null,
              feedback_review: feedback.review !== undefined ? feedback.review : prev.feedback_review,
              reviewed: feedback.review ? true : prev.reviewed
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
