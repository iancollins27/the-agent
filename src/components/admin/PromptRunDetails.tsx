
import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptRun } from './types';
import PromptRunActions from './PromptRunActions';
import PromptRunHeader from './prompt-details/PromptRunHeader';
import DetailsTab from './prompt-details/DetailsTab';
import { usePromptRunDetails } from '@/hooks/usePromptRunDetails';

type PromptRunDetailsProps = {
  promptRun: PromptRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onFeedbackChange?: (promptRunId: string, feedback: { 
    description?: string; 
    tags?: string[];
    review?: string;
  }) => void;
  onPromptRerun?: () => void;
  showReviewField?: boolean;
};

const PromptRunDetails: React.FC<PromptRunDetailsProps> = ({ 
  promptRun, 
  open,
  onOpenChange,
  onRatingChange,
  onFeedbackChange,
  onPromptRerun,
  showReviewField = true // Default to showing review field
}) => {
  const {
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
  } = usePromptRunDetails({
    promptRun,
    onOpenChange,
    onPromptRerun
  });

  if (!promptRun) return null;

  const handleSaveFeedbackClick = () => {
    if (onFeedbackChange && promptRun) {
      const tags = feedbackTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      onFeedbackChange(promptRun.id, {
        description: feedbackDescription || null,
        tags: tags.length > 0 ? tags : null,
        review: showReviewField ? feedbackReview || null : null
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <PromptRunHeader 
          promptRun={promptRun} 
          handleRerunPrompt={handleRerunPrompt} 
          isRerunning={isRerunning} 
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <DetailsTab 
              promptRun={promptRun}
              feedbackDescription={feedbackDescription}
              feedbackTags={feedbackTags}
              feedbackReview={feedbackReview}
              setFeedbackDescription={setFeedbackDescription}
              setFeedbackTags={setFeedbackTags}
              setFeedbackReview={setFeedbackReview}
              handleSaveFeedback={handleSaveFeedbackClick}
              onRatingChange={onRatingChange}
              showReviewField={showReviewField}
            />
          </TabsContent>
          
          <TabsContent value="actions">
            <PromptRunActions promptRunId={promptRun.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PromptRunDetails;
