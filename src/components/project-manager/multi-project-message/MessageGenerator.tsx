
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from '../../admin/types';

interface MessageGeneratorProps {
  rooferName: string;
  projects: PromptRun[];
  onMessageGenerated: (message: string) => void;
}

const MessageGenerator: React.FC<MessageGeneratorProps> = ({ 
  rooferName, 
  projects,
  onMessageGenerated 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
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
    
    try {
      console.log(`Checking for projects with pending actions for roofer ${rooferName}`);
      
      // First, fetch action records to filter only projects that need roofer action
      const { data: actionData, error: actionError } = await supabase
        .from('action_records')
        .select('project_id, action_type, status')
        .in('project_id', projectIds)
        .eq('status', 'pending');
        
      if (actionError) {
        console.error('Error fetching action records:', actionError);
        throw new Error('Failed to check for pending actions');
      }
      
      // Filter to get projects that have pending actions
      const projectsWithPendingActions = new Set(
        actionData.map(action => action.project_id)
      );
      
      const filteredProjectIds = projectIds.filter(id => 
        projectsWithPendingActions.has(id)
      );
      
      if (filteredProjectIds.length === 0) {
        setIsGenerating(false);
        toast({
          variant: "destructive",
          title: "No action required",
          description: "None of the selected projects require action from this roofer.",
        });
        return;
      }
      
      console.log(`Generating message for roofer ${rooferName} with ${filteredProjectIds.length} projects that need action`);
      
      // Call the edge function to generate a consolidated message
      const { data, error } = await supabase.functions.invoke('generate-multi-project-message', {
        body: { 
          projectIds: filteredProjectIds,
          rooferName: rooferName
        }
      });
      
      if (error) {
        console.error('Error invoking function:', error);
        throw error;
      }
      
      if (!data) {
        throw new Error('No response data received');
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      onMessageGenerated(data.message);
      toast({
        title: "Message generated",
        description: `Multi-project message for ${filteredProjectIds.length} project(s) has been generated successfully.`,
      });
    } catch (error) {
      console.error('Error generating multi-project message:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate multi-project message. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
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
  );
};

export default MessageGenerator;
