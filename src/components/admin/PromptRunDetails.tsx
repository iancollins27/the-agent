
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import PromptRunRating from './PromptRunRating';
import { PromptRun } from './types';

type PromptRunDetailsProps = {
  promptRun: PromptRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onFeedbackChange?: (promptRunId: string, feedback: { 
    description?: string; 
    tags?: string[] 
  }) => void;
};

const PromptRunDetails: React.FC<PromptRunDetailsProps> = ({ 
  promptRun, 
  open,
  onOpenChange,
  onRatingChange,
  onFeedbackChange
}) => {
  const [feedbackDescription, setFeedbackDescription] = useState<string>('');
  const [feedbackTags, setFeedbackTags] = useState<string>('');

  // Initialize state when promptRun changes
  React.useEffect(() => {
    if (promptRun) {
      setFeedbackDescription(promptRun.feedback_description || '');
      setFeedbackTags((promptRun.feedback_tags || []).join(', '));
    }
  }, [promptRun]);

  if (!promptRun) return null;

  const handleSaveFeedback = () => {
    if (onFeedbackChange && promptRun) {
      const tags = feedbackTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      onFeedbackChange(promptRun.id, {
        description: feedbackDescription || null,
        tags: tags.length > 0 ? tags : null
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prompt Run Details</DialogTitle>
          <DialogDescription>
            Created at {new Date(promptRun.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Evaluation section at the top of the modal */}
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

          {/* Prompt Details with improved formatting */}
          <div>
            <h3 className="font-medium mb-2">Prompt Input</h3>
            <pre className="bg-slate-100 p-4 rounded overflow-auto max-h-60 text-sm whitespace-pre-wrap break-words">
              {promptRun.prompt_input || promptRun.prompt_text || 'No input available'}
            </pre>
          </div>
          
          {(promptRun.prompt_output || promptRun.result) && (
            <div>
              <h3 className="font-medium mb-2">Prompt Output</h3>
              <pre className="bg-slate-100 p-4 rounded overflow-auto max-h-60 text-sm whitespace-pre-wrap break-words">
                {promptRun.prompt_output || promptRun.result}
              </pre>
            </div>
          )}
          
          {promptRun.error_message && (
            <div>
              <h3 className="font-medium mb-2 text-red-500">Error</h3>
              <pre className="bg-red-50 p-4 rounded overflow-auto max-h-60 text-sm text-red-500 whitespace-pre-wrap break-words">
                {promptRun.error_message}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromptRunDetails;
