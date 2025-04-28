
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
import PromptRunActions from './PromptRunActions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { rerunPrompt } from "@/utils/promptRunsApi";

type PromptRunDetailsProps = {
  promptRun: PromptRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onFeedbackChange?: (promptRunId: string, feedback: { 
    description?: string; 
    tags?: string[] 
  }) => void;
  onPromptRerun?: () => void; // New prop to handle refresh after a re-run
};

const PromptRunDetails: React.FC<PromptRunDetailsProps> = ({ 
  promptRun, 
  open,
  onOpenChange,
  onRatingChange,
  onFeedbackChange,
  onPromptRerun
}) => {
  const [feedbackDescription, setFeedbackDescription] = useState<string>('');
  const [feedbackTags, setFeedbackTags] = useState<string>('');
  const [activeTab, setActiveTab] = useState('details');
  const [isRerunning, setIsRerunning] = useState(false);

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
        
        // Close the dialog and refresh data
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>Prompt Run Details</DialogTitle>
            <DialogDescription>
              Created at {new Date(promptRun.created_at).toLocaleString()}
            </DialogDescription>
            {/* Add project address display */}
            <div className="mt-2 text-sm flex items-center">
              {promptRun.project_address && (
                <Badge variant="outline" className="font-normal">
                  {promptRun.project_address}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Re-run button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRerunPrompt}
              disabled={isRerunning}
              className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRerunning ? 'animate-spin' : ''}`} />
              {isRerunning ? "Running..." : "Re-run"}
            </Button>
            
            {/* CRM link button */}
            {promptRun.project_crm_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(promptRun.project_crm_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                CRM Record
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
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
