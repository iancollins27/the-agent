
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import PromptRunRating from '../PromptRunRating';
import PromptSection from '../prompt-details/PromptSection';

interface FeedbackRun {
  id: string;
  created_at: string;
  status: string;
  ai_provider: string;
  ai_model: string;
  prompt_input: string;
  prompt_output: string | null;
  error_message: string | null;
  error: boolean;
  feedback_description: string;
  feedback_rating: number | null;
  feedback_review: string | null;
  feedback_tags: string[] | null;
  project_address: string | null;
  project_manager: string | null;
  project_crm_url: string | null;
  reviewed: boolean;
}

interface FeedbackDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRun: FeedbackRun | null;
  feedbackReview: string;
  setFeedbackReview: (value: string) => void;
  isSaving: boolean;
  handleSaveFeedbackReview: () => void;
  isReviewed: (run: FeedbackRun) => boolean;
}

const FeedbackDetailsDialog: React.FC<FeedbackDetailsDialogProps> = ({ 
  isOpen,
  onOpenChange,
  selectedRun,
  feedbackReview,
  setFeedbackReview,
  isSaving,
  handleSaveFeedbackReview,
  isReviewed
}) => {
  if (!selectedRun) return null;

  // Format date function
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return 'Invalid date';
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>Feedback Details</DialogTitle>
            <DialogDescription>
              {selectedRun.project_address ? `Project: ${selectedRun.project_address}` : 'No project address available'}
              <p className="text-sm text-muted-foreground mt-1">
                {formatDate(selectedRun.created_at)}
              </p>
            </DialogDescription>
          </div>
          
          {selectedRun.project_crm_url && (
            <Button
              variant="secondary"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => window.open(selectedRun.project_crm_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open CRM
            </Button>
          )}
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Evaluation Section */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Evaluation</h3>
            
            <div className="grid gap-2">
              <div>
                <span className="text-sm font-medium">Rating:</span>
                <PromptRunRating 
                  rating={selectedRun.feedback_rating}
                  onRatingChange={() => {}}
                  size="sm"
                />
              </div>
              
              <div>
                <span className="text-sm font-medium">Tags:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedRun.feedback_tags && selectedRun.feedback_tags.length > 0 ? (
                    selectedRun.feedback_tags.map((tag, index) => (
                      <Badge key={index} variant="outline">{tag}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>
              
              <div>
                <span className="text-sm font-medium">Feedback:</span>
                <p className="text-sm mt-1">{selectedRun.feedback_description || 'No feedback provided'}</p>
              </div>

              {/* Feedback Review Section */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Feedback Review:</span>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="reviewed" 
                        checked={isReviewed(selectedRun)}
                        disabled
                      />
                      <label htmlFor="reviewed" className="text-sm text-muted-foreground">
                        {isReviewed(selectedRun) ? 'Reviewed' : 'Not reviewed'}
                      </label>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleSaveFeedbackReview}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Review"}
                  </Button>
                </div>
                <Textarea
                  value={feedbackReview}
                  onChange={(e) => setFeedbackReview(e.target.value)}
                  placeholder="Enter your review of this feedback..."
                  className="w-full"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <PromptSection 
            title="Prompt Input"
            content={selectedRun.prompt_input || 'No input available'}
          />
          
          <PromptSection 
            title="Prompt Output"
            content={selectedRun.prompt_output || 'No output available'}
          />
          
          {selectedRun.error_message && (
            <PromptSection 
              title="Error"
              content={selectedRun.error_message}
              isError={true}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDetailsDialog;
