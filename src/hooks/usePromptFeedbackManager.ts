
import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from '@tanstack/react-query';
import { PromptRun } from '@/components/admin/types';

export const usePromptFeedbackManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});

  // Function to update a prompt run with new ratings
  const handleRatingChange = async (promptRunId: string, rating: number | null) => {
    setIsUpdating(prev => ({ ...prev, [promptRunId]: true }));
    
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({ feedback_rating: rating })
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      // Update the cache with the new rating without refetching
      queryClient.setQueriesData({ queryKey: ["prompt-runs"] }, (oldData: any) => {
        if (!oldData) return oldData;
        
        const newData = { ...oldData };
        if (newData.data) {
          newData.data = newData.data.map((run: PromptRun) =>
            run.id === promptRunId ? { ...run, feedback_rating: rating } : run
          );
        }
        return newData;
      });

      toast({
        title: rating ? "Rating Updated" : "Rating Cleared",
        description: "Prompt run rating has been updated",
      });
    } catch (error) {
      console.error('Error updating rating:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update rating. Please try again.",
      });
    } finally {
      setIsUpdating(prev => ({ ...prev, [promptRunId]: false }));
    }
  };

  // Function to update feedback text and tags
  const handleFeedbackChange = async (promptRunId: string, feedback: { 
    description?: string; 
    tags?: string[] 
  }) => {
    setIsUpdating(prev => ({ ...prev, [promptRunId]: true }));
    
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({
          feedback_description: feedback.description,
          feedback_tags: feedback.tags
        })
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      // Update the cache without refetching
      queryClient.setQueriesData({ queryKey: ["prompt-runs"] }, (oldData: any) => {
        if (!oldData) return oldData;
        
        const newData = { ...oldData };
        if (newData.data) {
          newData.data = newData.data.map((run: PromptRun) =>
            run.id === promptRunId ? { 
              ...run, 
              feedback_description: feedback.description || null, 
              feedback_tags: feedback.tags || null 
            } : run
          );
        }
        return newData;
      });

      toast({
        title: "Feedback Updated",
        description: "Your feedback has been saved successfully",
      });
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update feedback. Please try again.",
      });
    } finally {
      setIsUpdating(prev => ({ ...prev, [promptRunId]: false }));
    }
  };

  // Function to mark a prompt run as reviewed
  const handleRunReviewed = async (promptRunId: string) => {
    setIsUpdating(prev => ({ ...prev, [promptRunId]: true }));
    
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({ reviewed: true })
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      // Update the cache without refetching
      queryClient.setQueriesData({ queryKey: ["prompt-runs"] }, (oldData: any) => {
        if (!oldData) return oldData;
        
        const newData = { ...oldData };
        if (newData.data) {
          newData.data = newData.data.map((run: PromptRun) =>
            run.id === promptRunId ? { ...run, reviewed: true } : run
          );
        }
        return newData;
      });

      toast({
        title: "Marked as Reviewed",
        description: "The prompt run has been marked as reviewed",
      });
    } catch (error) {
      console.error('Error marking as reviewed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mark as reviewed",
      });
    } finally {
      setIsUpdating(prev => ({ ...prev, [promptRunId]: false }));
    }
  };

  return {
    handleRatingChange,
    handleFeedbackChange,
    handleRunReviewed,
    isUpdating
  };
};
