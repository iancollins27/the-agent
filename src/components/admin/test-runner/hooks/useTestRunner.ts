
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useMCPTools } from "./useMCPTools";
import { useContextData } from "./useContextData";
import { useAIConfig } from "./useAIConfig";
import { testRunnerService } from "../services/testRunnerService";
import { ProjectTestResult, TestRunnerHook } from "../types";

export const useTestRunner = (
  selectedPromptIds: string[],
  selectedProjectIds: string[],
  onTestComplete: (results: ProjectTestResult[]) => void,
  isMultiProjectTest: boolean = false
): TestRunnerHook => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Use our extracted hooks
  const { useMCP, setUseMCP, hasMCPOrchestrator, getAvailableTools } = useMCPTools();
  const { prepareContextData } = useContextData();
  const { getAIConfig } = useAIConfig();
  
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
      const { aiProvider, aiModel } = await getAIConfig();
      
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
      
      const allResults: ProjectTestResult[] = [];
      
      for (const projectId of selectedProjectIds) {
        try {
          // Prepare context data for this project
          const { projectData, contextData } = await prepareContextData(
            projectId, 
            isMultiProjectTest,
            availableTools
          );
          
          const projectResults = [];
          
          for (const promptId of selectedPromptIds) {
            // Fetch the prompt details
            const { data: promptData, error: promptError } = await supabase
              .from('workflow_prompts')
              .select('*')
              .eq('id', promptId)
              .single();
            
            if (promptError) throw promptError;
            
            // If using MCP with a non-orchestrator prompt, provide a warning
            if (useMCP && promptData.type !== 'mcp_orchestrator') {
              console.warn(`Using MCP mode with a non-orchestrator prompt type: ${promptData.type}`);
            }
            
            try {
              // Run the test using our service
              const data = await testRunnerService.runPromptTest({
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
              });
              
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
        } catch (projectError) {
          console.error(`Error processing project ${projectId}:`, projectError);
          allResults.push({
            projectId,
            results: [{
              error: `Project error: ${projectError.message}`,
              diagnostics: { projectId }
            }]
          });
        }
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
