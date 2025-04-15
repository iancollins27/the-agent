
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { MessageSquare, Eye, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from '../admin/types';

interface MultiProjectMessageProps {
  rooferName: string;
  projects: PromptRun[];
}

const MultiProjectMessage: React.FC<MultiProjectMessageProps> = ({ rooferName, projects }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [consolidatedMessage, setConsolidatedMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Extract projectIds and ensure they are valid strings
  const projectIds = projects
    .map(p => p.project_id)
    .filter((id): id is string => Boolean(id));

  const handleGenerateMessage = async () => {
    if (projectIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No projects selected",
        description: "There are no valid projects to generate a message for.",
      });
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      console.log(`Generating message for roofer ${rooferName} with projects:`, projectIds);
      
      // Call the edge function to generate a consolidated message
      const { data, error } = await supabase.functions.invoke('generate-multi-project-message', {
        body: { 
          projectIds: projectIds,
          rooferName: rooferName
        }
      });
      
      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setConsolidatedMessage(data.message);
      setHasGenerated(true);
      toast({
        title: "Message generated",
        description: "Multi-project message has been generated successfully.",
      });
    } catch (error) {
      console.error('Error generating multi-project message:', error);
      setError(error instanceof Error ? error.message : String(error));
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate multi-project message. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!consolidatedMessage.trim()) {
      toast({
        variant: "destructive",
        title: "Cannot send empty message",
        description: "Please generate or write a message before sending.",
      });
      return;
    }

    try {
      // Call the edge function to send the consolidated message
      const { data, error } = await supabase.functions.invoke('send-multi-project-message', {
        body: { 
          message: consolidatedMessage,
          rooferName: rooferName,
          projectIds: projectIds
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Message sent",
        description: `Message successfully sent to ${rooferName}.`,
      });
      
      setDialogOpen(false);
      setHasGenerated(false);
      setConsolidatedMessage('');
    } catch (error) {
      console.error('Error sending multi-project message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
    }
  };

  return (
    <div className="flex space-x-2">
      {error && (
        <p className="text-xs text-red-500">Error: {error}</p>
      )}
      
      {!hasGenerated ? (
        <Button 
          variant="outline"
          size="sm"
          onClick={handleGenerateMessage}
          disabled={isGenerating}
          className="flex items-center"
        >
          <MessageSquare className="mr-1 h-4 w-4" />
          {isGenerating ? 'Generating...' : 'Generate Multi Project Message'}
        </Button>
      ) : (
        <Button 
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="flex items-center"
        >
          <Eye className="mr-1 h-4 w-4" />
          View Multi-Project Message
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Multi-Project Message to {rooferName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Textarea 
              value={consolidatedMessage}
              onChange={(e) => setConsolidatedMessage(e.target.value)}
              placeholder="Message content..."
              className="min-h-[300px]"
            />
          </div>
          
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSendMessage} className="flex items-center">
              <Send className="mr-1 h-4 w-4" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MultiProjectMessage;
