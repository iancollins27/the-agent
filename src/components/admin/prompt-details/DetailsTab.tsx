
import React from 'react';
import { PromptRunUI } from '@/types/prompt-run';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import PromptRunRating from '../PromptRunRating';
import PromptSection from './PromptSection';

interface DetailsTabProps {
  promptRun: PromptRunUI;
  feedbackDescription: string;
  feedbackTags: string;
  feedbackReview?: string;
  setFeedbackDescription: (value: string) => void;
  setFeedbackTags: (value: string) => void;
  setFeedbackReview?: (value: string) => void;
  handleSaveFeedback: () => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
}

const DetailsTab: React.FC<DetailsTabProps> = ({ 
  promptRun,
  feedbackDescription,
  feedbackTags,
  feedbackReview = '',
  setFeedbackDescription,
  setFeedbackTags,
  setFeedbackReview = () => {},
  handleSaveFeedback,
  onRatingChange
}) => {
  return (
    <div className="space-y-6">
      {/* Evaluation Section */}
      <div className="space-y-4 bg-slate-50 p-4 rounded-md">
        <h3 className="text-lg font-medium">Evaluation</h3>
        
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Rating</span>
            </div>
            <PromptRunRating 
              rating={promptRun.feedback_rating} 
              onRatingChange={(rating) => onRatingChange(promptRun.id, rating)}
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Feedback Description</span>
            </div>
            <Textarea
              value={feedbackDescription}
              onChange={(e) => setFeedbackDescription(e.target.value)}
              placeholder="Provide feedback about this prompt run"
              className="w-full"
              rows={3}
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Feedback Tags <span className="text-xs text-gray-500">(comma separated)</span></span>
            </div>
            <Textarea
              value={feedbackTags}
              onChange={(e) => setFeedbackTags(e.target.value)}
              placeholder="Add tags (e.g. helpful, confusing, unclear)"
              className="w-full"
              rows={2}
            />
          </div>

          {/* Feedback Review Field */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Feedback Review</span>
            </div>
            <Textarea
              value={feedbackReview}
              onChange={(e) => setFeedbackReview(e.target.value)}
              placeholder="Write a review of this feedback"
              className="w-full"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end">
            <Button onClick={handleSaveFeedback}>
              Save Feedback
            </Button>
          </div>

          {promptRun.feedback_tags && promptRun.feedback_tags.length > 0 && (
            <div className="mt-2">
              <span className="text-sm font-medium mb-1 block">Current Tags:</span>
              <div className="flex flex-wrap gap-1">
                {promptRun.feedback_tags.map((tag, i) => (
                  <Badge key={i} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prompt Input */}
      <PromptSection 
        title="Prompt Input"
        content={promptRun.prompt_input || 'No input available'}
      />
      
      {/* Prompt Output */}
      <PromptSection 
        title="Prompt Output"
        content={promptRun.prompt_output || 'No output available'}
      />
      
      {/* Error (if exists) */}
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
