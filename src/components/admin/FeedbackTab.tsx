
import React, { useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usePromptRunData } from './promptRuns/usePromptRunData';
import { Card } from "@/components/ui/card";
import { format, parseISO, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { PromptRun } from './types';
import PromptRunRating from './PromptRunRating';
import PromptSection from './prompt-details/PromptSection';

const FeedbackTab = () => {
  const { promptRuns, loading } = usePromptRunData('COMPLETED');
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    setIsModalOpen(true);
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
              <TableHead>Feedback Description</TableHead>
              <TableHead>Feedback Tags</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                <TableCell>{run.feedback_description}</TableCell>
                <TableCell>
                  {run.feedback_tags ? run.feedback_tags.join(', ') : 'No tags'}
                </TableCell>
                <TableCell>{formatDate(run.created_at)}</TableCell>
                <TableCell className="text-right">
                  {run.project_crm_url && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      asChild
                      onClick={(e) => e.stopPropagation()} // Prevent row click
                    >
                      <Link
                        to={run.project_crm_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open CRM
                      </Link>
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
              <DialogHeader>
                <div className="flex justify-between items-start">
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
                      size="sm"
                      variant="secondary"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      asChild
                    >
                      <Link
                        to={selectedRun.project_crm_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open CRM
                      </Link>
                    </Button>
                  )}
                </div>
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
