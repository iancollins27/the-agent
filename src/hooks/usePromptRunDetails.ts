
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";
import { rerunPrompt } from "@/utils/api/prompt-runs";
import { PromptRun } from '@/components/admin/types';

interface UsePromptRunDetailsProps {
  promptRun: PromptRun | null;
  onOpenChange: (open: boolean) => void;
  onPromptRerun?: () => void;
}

export const usePromptRunDetails = ({ 
  promptRun, 
  onOpenChange, 
  onPromptRerun 
}: UsePromptRunDetailsProps) => {
  const [feedbackDescription, setFeedbackDescription] = useState<string>('');
  const [feedbackTags, setFeedbackTags] = useState<string>('');
  const [feedbackReview, setFeedbackReview] = useState<string>('');
  const [activeTab, setActiveTab] = useState('details');
  const [isRerunning, setIsRerunning] = useState(false);

  useEffect(() => {
    if (promptRun) {
      setFeedbackDescription(promptRun.feedback_description || '');
      setFeedbackTags((promptRun.feedback_tags || []).join(', '));
      setFeedbackReview(promptRun.feedback_review || '');
    }
  }, [promptRun]);

  const handleSaveFeedback = (onFeedbackChange?: (promptRunId: string, feedback: { 
    description?: string; 
    tags?: string[];
    review?: string;
  }) => void) => {
    if (onFeedbackChange && promptRun) {
      const tags = feedbackTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      // Set review and update reviewed status based on content
      const hasReviewContent = feedbackReview.trim().length > 0;
      
      onFeedbackChange(promptRun.id, {
        description: feedbackDescription || null,
        tags: tags.length > 0 ? tags : null,
        review: feedbackReview || null
      });
    }
  };

  const handleRerunPrompt = async () => {
    if (!promptRun) return;
    
    setIsRerunning(true);
    try {
      const result = await rerunPrompt(promptRun.id);
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Prompt has been re-run. New prompt run created.`,
        });
        
        onOpenChange(false);
        
        if (onPromptRerun) {
          onPromptRerun();
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to re-run prompt: ${result.error}`,
        });
      }
    } catch (error) {
      console.error("Error re-running prompt:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while re-running the prompt",
      });
    } finally {
      setIsRerunning(false);
    }
  };

  return {
    feedbackDescription,
    setFeedbackDescription,
    feedbackTags,
    setFeedbackTags,
    feedbackReview,
    setFeedbackReview,
    activeTab,
    setActiveTab,
    isRerunning,
    handleSaveFeedback,
    handleRerunPrompt
  };
};
