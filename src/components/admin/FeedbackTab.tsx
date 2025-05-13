
import React, { useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usePromptRunData } from './promptRuns/usePromptRunData';
import { Card } from "@/components/ui/card";
import { format, parseISO, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PromptRun } from './types';
import PromptRunRating from './PromptRunRating';
import PromptSection from './prompt-details/PromptSection';
import { ExternalLink, CheckSquare, Square } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

const FeedbackTab = () => {
  const { promptRuns, loading, setPromptRuns } = usePromptRunData('COMPLETED');
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackReview, setFeedbackReview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Filter prompt runs to only show those with feedback
  const feedbackRuns = promptRuns.filter(run => run.feedback_description);

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

  const handleRowClick = (run: PromptRun) => {
    setSelectedRun(run);
    setFeedbackReview(run.feedback_review || '');
    setIsModalOpen(true);
  };
  
  const handleOpenCRM = (e: React.MouseEvent, url: string) => {
    e.stopPropagation(); // Stop event propagation to prevent row click
    window.open(url, '_blank');
  };

  const handleSaveFeedbackReview = async () => {
    if (!selectedRun) return;
    
    setIsSaving(true);
    try {
      // Set reviewed status based on whether there's content in the feedback_review field
      const hasReviewContent = feedbackReview.trim().length > 0;

      const { error } = await supabase
        .from('prompt_runs')
        .update({ 
          feedback_review: feedbackReview,
          reviewed: hasReviewContent // Only set to true if there's actual content
        })
        .eq('id', selectedRun.id);

      if (error) {
        throw error;
      }

      // Update local state
      setPromptRuns(prev => 
        prev.map(run => 
          run.id === selectedRun.id 
            ? { ...run, feedback_review: feedbackReview, reviewed: hasReviewContent } 
            : run
        )
      );
      
      // Update selected run
      setSelectedRun(prev => 
        prev ? { ...prev, feedback_review: feedbackReview, reviewed: hasReviewContent } : null
      );

      toast({
        title: hasReviewContent ? "Feedback review saved" : "Feedback review cleared",
        description: hasReviewContent 
          ? "Your feedback review has been saved successfully." 
          : "The feedback review has been cleared."
      });
    } catch (error) {
      console.error('Error saving feedback review:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save feedback review. Please try again."
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Function to check if a prompt run has been reviewed based on content
  const isReviewed = (run: PromptRun) => {
    return run.feedback_review && run.feedback_review.trim().length > 0;
  };

  if (loading) {
    return <div>Loading feedback...</div>;
  }

  if (feedbackRuns.length === 0) {
    return <div>No feedback found.</div>;
  }

  return (
    <>
      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Address</TableHead>
              <TableHead>Project Manager</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Feedback Description</TableHead>
              <TableHead>Feedback Tags</TableHead>
              <TableHead>Feedback Reviewed</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbackRuns.map((run) => (
              <TableRow 
                key={run.id} 
                className="cursor-pointer hover:bg-slate-100"
                onClick={() => handleRowClick(run)}
              >
                <TableCell>{run.project_address || 'N/A'}</TableCell>
                <TableCell>{run.project_manager || 'No manager assigned'}</TableCell>
                <TableCell>
                  <PromptRunRating 
                    rating={run.feedback_rating || null} 
                    size="sm"
                  />
                </TableCell>
                <TableCell>{run.feedback_description}</TableCell>
                <TableCell>
                  {run.feedback_tags ? run.feedback_tags.join(', ') : 'No tags'}
                </TableCell>
                <TableCell className="text-center">
                  {isReviewed(run) ? 
                    <CheckSquare className="h-5 w-5 text-green-500" /> : 
                    <Square className="h-5 w-5 text-gray-300" />
                  }
                </TableCell>
                <TableCell>{formatDate(run.created_at)}</TableCell>
                <TableCell>
                  {run.project_crm_url && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={(e) => handleOpenCRM(e, run.project_crm_url!)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open CRM
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedRun && (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeedbackTab;
