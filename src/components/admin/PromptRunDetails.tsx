
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star, RefreshCw } from "lucide-react";
import { PromptRun } from './types';
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { rerunPrompt } from "@/utils/api/prompt-runs";
import PromptRunActions from './PromptRunActions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface PromptRunDetailsProps {
  promptRun: PromptRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onFeedbackChange: (promptRunId: string, feedback: string) => void;
  onPromptRerun?: () => void;
}

const PromptRunDetails: React.FC<PromptRunDetailsProps> = ({ 
  promptRun, 
  open, 
  onOpenChange, 
  onRatingChange,
  onFeedbackChange,
  onPromptRerun
}) => {
  const [feedback, setFeedback] = useState<string>('');
  const [rerunning, setRerunning] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (promptRun) {
      setFeedback(promptRun.feedback_description || '');
    }
  }, [promptRun]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleFeedbackUpdate = async () => {
    if (!promptRun) return;

    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({ feedback_description: feedback })
        .eq('id', promptRun.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Feedback updated successfully",
      });

      onFeedbackChange(promptRun.id, feedback);
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update feedback",
      });
    }
  };

  const renderStars = () => {
    if (!promptRun) return null;

    const rating = promptRun.feedback_rating || 0;
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 cursor-pointer ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => onRatingChange(promptRun.id, star === rating ? null : star)}
          />
        ))}
      </div>
    );
  };

  const handleRerunPrompt = async () => {
    if (!promptRun) return;
    
    try {
      setRerunning(true);
      
      const result = await rerunPrompt(promptRun.id);
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Prompt has been re-run. New prompt run created with ID: ${result.newPromptRunId}`,
        });
        
        if (onPromptRerun) {
          onPromptRerun();
        }
        handleClose();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to re-run prompt: ${result.error}`,
        });
      }
    } catch (error) {
      console.error('Error re-running prompt:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while re-running the prompt",
      });
    } finally {
      setRerunning(false);
    }
  };

  if (!promptRun) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80%] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prompt Run Details</DialogTitle>
          <DialogDescription>
            Details for prompt run ID: {promptRun.id}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4 pt-4">
            {/* Project Details */}
            <div className="my-4">
              <h3 className="text-lg font-semibold mb-2">Project Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Project Name:</strong> {promptRun.project_name || 'N/A'}
                </div>
                <div>
                  <strong>Project Address:</strong> {promptRun.project_address || 'N/A'}
                </div>
                <div>
                  <strong>Next Step:</strong> {promptRun.project_next_step || 'N/A'}
                </div>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="my-4">
              <h3 className="text-lg font-semibold mb-2">Prompt Input</h3>
              <div className="bg-gray-50 p-4 rounded border whitespace-pre-wrap">
                {promptRun.prompt_input || "No prompt input available"}
              </div>
            </div>

            {/* Prompt Output */}
            <div className="my-4">
              <h3 className="text-lg font-semibold mb-2">AI Response</h3>
              <div className="bg-gray-50 p-4 rounded border whitespace-pre-wrap">
                {promptRun.prompt_output || "No response available"}
              </div>
            </div>

            {/* Error Message (if any) */}
            {promptRun.error_message && (
              <div className="my-4">
                <h3 className="text-lg font-semibold mb-2 text-red-500">Error</h3>
                <div className="bg-red-50 p-4 rounded border border-red-200 text-red-700 whitespace-pre-wrap">
                  {promptRun.error_message}
                </div>
              </div>
            )}

            {/* Feedback and Rating */}
            <div className="my-4">
              <h3 className="text-lg font-semibold mb-2">Feedback and Rating</h3>
              {renderStars()}
              <Textarea 
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Add your feedback here..."
                className="mt-2"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="actions" className="pt-4">
            <PromptRunActions promptRunId={promptRun.id} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button type="button" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800" onClick={handleRerunPrompt} disabled={rerunning}>
            <RefreshCw className={`h-4 w-4 mr-1 ${rerunning ? 'animate-spin' : ''}`} />
              {rerunning ? "Running..." : "Re-run"}
          </Button>
          <Button type="button" onClick={handleFeedbackUpdate}>
            Update Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PromptRunDetails;
