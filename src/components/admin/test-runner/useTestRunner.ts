
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTestRunner = (
  selectedPromptIds: string[],
  selectedProjectIds: string[],
  onTestComplete: (results: any) => void,
  isMultiProjectTest: boolean = false
) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [useMCP, setUseMCP] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
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
  
  // Get available tools based on MCP mode
  const getAvailableTools = (useMCPMode: boolean): string[] => {
    if (!useMCPMode) return [];
    
    return [
      'detect_action', 
      'create_action_record', 
      'knowledge_base_lookup'
    ];
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
    setError(null);
    
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
      
      // Get the available tools based on MCP mode
      const availableTools = getAvailableTools(useMCP || isMCPOrchestratorSelected);
      
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
          property_address: projectData.Address || '',
          available_tools: availableTools
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
          
          try {
            console.log("Calling test-workflow-prompt function with:", {
              promptType: promptData.type,
              projectId: projectData.id,
              useMCP: useMCP || promptData.type === 'mcp_orchestrator'
            });
            
            // Call the edge function to test the prompt with improved error handling
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
                useMCP: useMCP || promptData.type === 'mcp_orchestrator' // Force MCP for orchestrator prompts
              }
            });
            
            if (error) {
              console.error("Edge function error:", error);
              throw new Error(`Edge function error: ${error.message || "Unknown error"}`);
            }
            
            if (!data) {
              throw new Error("No data returned from edge function");
            }
            
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
          } catch (functionError) {
            console.error(`Error calling test-workflow-prompt function:`, functionError);
            
            // Add more detailed diagnostics
            const diagnosticInfo = {
              promptId,
              promptType: promptData.type,
              projectId: projectData.id,
              error: functionError.message || "Unknown error",
              useMCP: useMCP || promptData.type === 'mcp_orchestrator'
            };
            
            // Set a user-friendly error message
            setError(`Failed to run test: ${functionError.message || "Unknown error"}. Please check the Edge Function logs for more details.`);
            
            // Add error information to the results so we can show it in the UI
            projectResults.push({
              type: promptData.type,
              error: functionError.message || "Unknown error",
              diagnostics: diagnosticInfo
            });
          }
        }
        
        allResults.push({
          projectId: projectId,
          results: projectResults
        });
      }
      
      onTestComplete(allResults);
    } catch (error) {
      console.error('Error testing prompt:', error);
      setError(error.message || "Unknown error occurred");
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: `Error: ${error.message || "Unknown error occurred"}`
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    isLoading,
    useMCP,
    error,
    setUseMCP,
    runTest
  };
};
