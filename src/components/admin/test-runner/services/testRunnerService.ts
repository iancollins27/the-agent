
import { supabase } from "@/integrations/supabase/client";

/**
 * Service for making API calls to the test-workflow-prompt function
 */
export const testRunnerService = {
  runPromptTest: async (params: {
    promptType: string;
    promptText: string;
    projectId: string;
    contextData: any;
    aiProvider: string;
    aiModel: string;
    workflowPromptId: string;
    initiatedBy: string;
    isMultiProjectTest: boolean;
    useMCP: boolean;
  }) => {
    console.log("Calling test-workflow-prompt function with:", {
      promptType: params.promptType,
      projectId: params.projectId,
      useMCP: params.useMCP
    });
    
    // Call the edge function to test the prompt
    const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
      body: {
        promptType: params.promptType,
        promptText: params.promptText,
        projectId: params.projectId,
        contextData: params.contextData,
        aiProvider: params.aiProvider,
        aiModel: params.aiModel,
        workflowPromptId: params.workflowPromptId,
        initiatedBy: params.initiatedBy,
        isMultiProjectTest: params.isMultiProjectTest,
        useMCP: params.useMCP
      }
    });
    
    if (error) {
      console.error("Edge function error:", error);
      throw new Error(`Edge function error: ${error.message || "Unknown error"}`);
    }
    
    if (!data) {
      throw new Error("No data returned from edge function");
    }
    
    return data;
  }
};
