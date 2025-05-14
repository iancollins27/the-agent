
/**
 * Centralized service for MCP (Model Context Protocol) operations
 * This centralizes all MCP-related functionality to avoid redundancy
 */
import { updatePromptRunWithResult } from "../database/prompt-runs.ts";
import { getMCPOrchestratorPrompt } from "../mcp-system-prompts.ts";
import { getToolDefinitions, filterTools } from "../tools/toolRegistry.ts";
import { getLatestWorkflowPrompt } from "../database/workflow-prompts.ts";

/**
 * Executes an MCP request with the given parameters
 * This is the main entry point for MCP operations
 */
export async function executeMCPRequest(
  supabase: any,
  projectId: string,
  contextData: any,
  aiProvider: string = 'openai',
  aiModel: string = 'gpt-4o',
  promptRunId: string
) {
  try {
    console.log(`Starting MCP execution for project ${projectId} using ${aiProvider} ${aiModel}`);

    // Ensure we have the needed context data
    if (!contextData) {
      throw new Error("Context data is required for MCP execution");
    }
    
    // Security check: Ensure company ID is provided for multi-tenant security
    if (!contextData.company_id) {
      console.error("Security error: Missing company_id in context data for MCP execution");
      throw new Error("Company context is required for secure MCP execution");
    }
    
    // Validate that the project belongs to the specified company
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('company_id')
      .eq('id', projectId)
      .single();
      
    if (projectError || !projectData) {
      throw new Error(`Project verification failed: ${projectError?.message || "Project not found"}`);
    }
    
    if (projectData.company_id !== contextData.company_id) {
      console.error(`Security error: Project company (${projectData.company_id}) doesn't match user company (${contextData.company_id})`);
      throw new Error("You don't have permission to access this project as it belongs to a different company");
    }

    // Process the MCP request based on the provider
    let result;
    if (aiProvider.toLowerCase() === 'openai') {
      const { processOpenAIRequest } = await import("./providers/openai/index.ts");
      
      // Fetch the MCP orchestrator prompt if we need it
      let orchestratorPrompt = null;
      try {
        const mcpPrompt = await getLatestWorkflowPrompt(supabase, 'mcp_orchestrator');
        if (mcpPrompt && mcpPrompt.prompt_text) {
          console.log("Using MCP orchestrator prompt from database");
          orchestratorPrompt = mcpPrompt.prompt_text;
        }
      } catch (err) {
        console.error("Error fetching MCP orchestrator prompt:", err);
      }

      // Prepare tool definitions with multi-tenant context
      let availableTools;
      if (contextData.available_tools && Array.isArray(contextData.available_tools) && contextData.available_tools.length > 0) {
        availableTools = filterTools(contextData.available_tools);
      } else {
        availableTools = getToolDefinitions();
      }

      // Extract relevant context for the MCP prompt
      const milestoneInstructions = contextData.milestone_instructions || null;
      const toolNames = availableTools.map(t => t.function.name);
      
      // Generate the enhanced system prompt
      const enhancedSystemPrompt = getMCPOrchestratorPrompt(
        toolNames,
        milestoneInstructions,
        orchestratorPrompt,
        contextData
      );

      // Execute the OpenAI MCP request
      result = await processOpenAIRequest(
        enhancedSystemPrompt,
        aiModel,
        supabase,
        promptRunId,
        projectId,
        true, // Use MCP
        contextData
      );
    } else if (aiProvider.toLowerCase() === 'claude') {
      const { processClaudeRequest } = await import("./providers/claudeProvider.ts");
      result = await processClaudeRequest(
        "", // Claude doesn't use the MCP protocol yet
        aiModel,
        supabase,
        promptRunId,
        projectId
      );
    } else {
      throw new Error(`Unsupported AI provider for MCP: ${aiProvider}`);
    }

    return result;
  } catch (error) {
    console.error("Error in MCP service:", error);
    
    // Update the prompt run with the error
    if (promptRunId) {
      await updatePromptRunWithResult(
        supabase, 
        promptRunId, 
        `MCP execution error: ${error.message || 'Unknown error'}`,
        true
      );
    }
    
    // Return a structured error response
    return { 
      result: `Error executing MCP: ${error.message || 'Unknown error'}`,
      error: error.message || 'Unknown error in MCP execution',
      status: 'error'
    };
  }
}
