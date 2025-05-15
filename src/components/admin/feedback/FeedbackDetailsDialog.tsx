
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PromptRunRating from '../PromptRunRating';
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';

interface FeedbackRun {
  id: string;
  created_at: string;
  project_address: string | null;
  project_manager: string | null;
  prompt_input: string;
  prompt_output: string | null;
  feedback_description: string;
  feedback_rating: number | null;
  feedback_review: string | null;
  feedback_tags: string[] | null;
  reviewed: boolean;
}

interface FeedbackDetailsDialogProps {
  run: FeedbackRun;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveReview: (review: string) => void;
  isSaving: boolean;
}

const FeedbackDetailsDialog: React.FC<FeedbackDetailsDialogProps> = ({
  run,
  open,
  onOpenChange,
  onSaveReview,
  isSaving
}) => {
  const [review, setReview] = useState('');

  useEffect(() => {
    if (run) {
      setReview(run.feedback_review || '');
    }
  }, [run]);

  const handleSave = () => {
    onSaveReview(review);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'PPpp');
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (!run) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feedback Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Info */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Project Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Address:</span>
                <p>{run.project_address || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Project Manager:</span>
                <p>{run.project_manager || 'No manager assigned'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Date:</span>
                <p>{formatDate(run.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Feedback Info */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Feedback Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Rating:</span>
                <div className="mt-1">
                  <PromptRunRating rating={run.feedback_rating} size="md" />
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Tags:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {run.feedback_tags && run.feedback_tags.length > 0 ? (
                    run.feedback_tags.map((tag, index) => (
                      <Badge key={index} variant="outline">{tag}</Badge>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No tags</p>
                  )}
                </div>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Description:</span>
              <p className="mt-1">{run.feedback_description}</p>
            </div>
          </div>

          {/* Prompt Input and Output */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Prompt Information</h3>
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Input:</span>
                <div className="mt-1 p-4 bg-gray-100 rounded-md whitespace-pre-wrap overflow-x-auto">
                  {run.prompt_input}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Output:</span>
                <div className="mt-1 p-4 bg-gray-100 rounded-md whitespace-pre-wrap overflow-x-auto">
                  {run.prompt_output || 'No output available'}
                </div>
              </div>
            </div>
          </div>

          {/* Review Section */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Review</h3>
            <Textarea 
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="min-h-[120px]"
              placeholder="Add your review or notes about this feedback..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDetailsDialog;
