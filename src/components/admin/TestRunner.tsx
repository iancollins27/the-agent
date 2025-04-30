
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { WorkflowType } from "@/types/workflow";

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
  
  // Check if MCP Orchestrator prompt is selected
  const hasMCPOrchestrator = async (promptIds: string[]): Promise<boolean> => {
    if (promptIds.length === 0) return false;
    
    const { data } = await supabase
      .from('workflow_prompts')
      .select('type')
      .in('id', promptIds);
      
    return data?.some(prompt => prompt.type === 'mcp_orchestrator') || false;
  };
  
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
      
      // Check if any selected prompt is an MCP orchestrator
      const isMCPOrchestratorSelected = await hasMCPOrchestrator(selectedPromptIds);
      
      // If MCP orchestrator is selected, force MCP mode on
      if (isMCPOrchestratorSelected && !useMCP) {
        setUseMCP(true);
        toast({
          title: "MCP Mode Enabled",
          description: "MCP Orchestrator prompt selected, enabling MCP mode automatically."
        });
      }
      
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
            Address,
            companies(name),
            project_tracks(name, "track base prompt", Roles)
          `)
          .eq('id', projectId)
          .single();
        
        if (projectError) {
          console.error("Error fetching project:", projectError);
          throw projectError;
        }
        
        if (!projectData) {
          console.error("No project data found for ID:", projectId);
          throw new Error("Project not found");
        }
        
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
          isMultiProjectTest: isMultiProjectTest,
          property_address: projectData.Address || '',  // Use the Address field
          available_tools: useMCP ? [
            'detect_action',
            'generate_action',
            'knowledge_base_lookup',
            'create_action_record'
          ] : []
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
          
          // If using MCP with a non-orchestrator prompt, provide a warning in the console
          if (useMCP && promptData.type !== 'mcp_orchestrator') {
            console.warn(`Using MCP mode with a non-orchestrator prompt type: ${promptData.type}`);
          }
          
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
            knowledgeResultsCount: data.knowledgeResults?.length || 0
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
        <Alert className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="ml-2">
            <span className="font-medium">Model Context Protocol (MCP) enabled</span>: This uses a structured approach 
            for AI interactions with tool-calling capabilities for knowledge base integration, action record creation, and workflow orchestration.
            Currently works with OpenAI and Claude providers only.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default TestRunner;
