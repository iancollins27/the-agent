
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import PromptRunRating from '../PromptRunRating';
import { PromptRun } from '../types';
import PromptSection from './PromptSection';

interface DetailsTabProps {
  promptRun: PromptRun;
  feedbackDescription: string;
  feedbackTags: string;
  setFeedbackDescription: (value: string) => void;
  setFeedbackTags: (value: string) => void;
  handleSaveFeedback: () => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
}

const DetailsTab: React.FC<DetailsTabProps> = ({
  promptRun,
  feedbackDescription,
  feedbackTags,
  setFeedbackDescription,
  setFeedbackTags,
  handleSaveFeedback,
  onRatingChange
}) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-medium">Evaluation</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rating">Rating</Label>
              <PromptRunRating 
                rating={promptRun.feedback_rating}
                onRatingChange={(rating) => onRatingChange(promptRun.id, rating)}
                size="md"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                value={feedbackTags}
                onChange={(e) => setFeedbackTags(e.target.value)}
                placeholder="accuracy, clarity, etc."
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea
                id="feedback"
                value={feedbackDescription}
                onChange={(e) => setFeedbackDescription(e.target.value)}
                placeholder="Provide your feedback about this prompt run..."
                rows={3}
              />
            </div>

            <div className="md:col-span-2">
              <Button onClick={handleSaveFeedback} className="mt-2">
                Save Feedback
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PromptSection 
        title="Prompt Input"
        content={promptRun.prompt_input || 'No input available'}
      />
      
      {promptRun.prompt_output && (
        <PromptSection 
          title="Prompt Output"
          content={promptRun.prompt_output}
        />
      )}
      
      {promptRun.error_message && (
        <PromptSection 
          title="Error"
          content={promptRun.error_message}
          isError={true}
        />
      )}
    </div>
  );
};

export default DetailsTab;
