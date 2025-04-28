
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

type TestRunnerProps = {
  selectedPromptIds: string[];
  selectedProjectIds: string[];
  onTestComplete: (results: any) => void;
  isMultiProjectTest?: boolean;
};

const TestRunner = ({ 
  selectedPromptIds, 
  selectedProjectIds, 
  onTestComplete, 
  isMultiProjectTest = false 
}: TestRunnerProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [useMCP, setUseMCP] = useState<boolean>(false);
  const { toast } = useToast();
  
  const runTest = async () => {
    if (selectedPromptIds.length === 0 || selectedProjectIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Selection Required",
        description: "Please select at least one prompt and one project to test."
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get current user information
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || 'unknown';
      
      // Get AI configuration
      const { data: aiConfig, error: aiConfigError } = await supabase
        .from('ai_config')
        .select('provider, model')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      const aiProvider = aiConfig?.provider || 'openai';
      const aiModel = aiConfig?.model || 'gpt-4o';
      
      const allResults = [];
      
      for (const projectId of selectedProjectIds) {
        // Fetch the project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select(`
            id,
            crm_id,
            summary,
            next_step,
            company_id,
            project_track,
            property_address,
            companies(name),
            project_tracks(name, "track base prompt", Roles)
          `)
          .eq('id', projectId)
          .single();
        
        if (projectError) throw projectError;
        
        // Prepare context data
        const contextData = {
          summary: projectData.summary || '',
          next_step: projectData.next_step || '',
          company_name: projectData.companies?.name || 'Unknown Company',
          track_name: projectData.project_tracks?.name || 'Default Track',
          track_base_prompt: projectData.project_tracks?.["track base prompt"] || '',
          track_roles: projectData.project_tracks?.Roles || '',
          current_date: new Date().toISOString().split('T')[0],
          milestone_instructions: '',
          action_description: 'Sample action for testing',
          isMultiProjectTest: isMultiProjectTest, // Add this flag to the context data
          property_address: projectData.property_address || ''  // Include the property address
        };
        
        // Get milestone instructions if this is a next step
        if (projectData.next_step) {
          const { data: milestoneData } = await supabase
            .from('project_track_milestones')
            .select('prompt_instructions')
            .eq('track_id', projectData.project_track)
            .eq('step_title', projectData.next_step)
            .maybeSingle();
            
          if (milestoneData) {
            contextData.milestone_instructions = milestoneData.prompt_instructions || '';
          }
        }
        
        const projectResults = [];
        
        for (const promptId of selectedPromptIds) {
          // Fetch the prompt details
          const { data: promptData, error: promptError } = await supabase
            .from('workflow_prompts')
            .select('*')
            .eq('id', promptId)
            .single();
          
          if (promptError) throw promptError;
          
          // Call the edge function to test the prompt
          const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
            body: {
              promptType: promptData.type,
              promptText: promptData.prompt_text,
              projectId: projectData.id,
              contextData: contextData,
              aiProvider: aiProvider,
              aiModel: aiModel,
              workflowPromptId: promptData.id,
              initiatedBy: userEmail,
              isMultiProjectTest: isMultiProjectTest,
              useMCP: useMCP // Use Model Context Protocol if enabled
            }
          });
          
          if (error) throw error;
          
          projectResults.push({
            type: promptData.type,
            output: data.output,
            finalPrompt: data.finalPrompt,
            promptRunId: data.promptRunId,
            actionRecordId: data.actionRecordId,
            reminderSet: data.reminderSet || false,
            nextCheckDateInfo: data.nextCheckDateInfo,
            usedMCP: data.usedMCP,
            humanReviewRequestId: data.humanReviewRequestId,
            knowledgeResultsCount: data.knowledgeResults
          });
        }
        
        allResults.push({
          projectId: projectId,
          results: projectResults
        });
      }
      
      onTestComplete(allResults);
    } catch (error) {
      console.error('Error testing prompt:', error);
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: `Error: ${error.message || "Unknown error occurred"}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch 
            id="mcp-toggle" 
            checked={useMCP} 
            onCheckedChange={setUseMCP} 
          />
          <label htmlFor="mcp-toggle" className="text-sm font-medium">
            Use Model Context Protocol (MCP)
          </label>
        </div>
        <Button 
          onClick={runTest} 
          disabled={isLoading || selectedPromptIds.length === 0 || selectedProjectIds.length === 0}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : isMultiProjectTest ? "Run Multi-Project Test" : "Run Test"}
        </Button>
      </div>
      {useMCP && (
        <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
          <span className="font-medium">Model Context Protocol (MCP) enabled</span>: This uses a more structured approach 
          for AI interactions with tool-calling capabilities for knowledge base integration and human-in-the-loop workflows.
          Currently works with OpenAI and Claude providers only.
        </div>
      )}
    </div>
  );
};

export default TestRunner;
