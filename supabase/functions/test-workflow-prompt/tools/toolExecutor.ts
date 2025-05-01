
/**
 * Central tool execution logic
 */
import { getToolByName } from './registry.ts';
import { ToolExecutionResult } from './types.ts';
import { createToolExecutionLogger } from './utils/logging.ts';

const executeWithLogging = createToolExecutionLogger();

/**
 * Executes a tool call with the given parameters
 */
export async function executeToolCall(
  supabase: any, 
  toolName: string, 
  args: any, 
  promptRunId: string, 
  projectId: string
): Promise<ToolExecutionResult> {
  return executeWithLogging(toolName, args, async () => {
    try {
      // Get the tool from the registry
      const tool = getToolByName(toolName);
      
      if (!tool) {
        console.error(`Tool not found: ${toolName}`);
        return {
          status: 'error',
          error: `Tool "${toolName}" not found`
        };
      }
      
      // Execute the tool with the provided arguments
      console.log(`Executing tool: ${toolName} with args:`, JSON.stringify(args));
      
      // If the tool has a validate function, use it
      if (tool.handler.validate) {
        const validation = tool.handler.validate(args);
        if (!validation.valid) {
          console.error(`Validation failed for tool ${toolName}:`, validation.errors);
          return {
            status: 'error',
            error: `Validation failed: ${validation.errors.join(', ')}`
          };
        }
      }
      
      // Execute the tool
      const result = await tool.handler.execute(supabase, args, promptRunId, projectId);
      
      console.log(`Tool ${toolName} execution completed with result:`, result);
      
      return {
        status: 'success',
        result
      };
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return {
        status: 'error',
        error: error.message || `Unknown error executing tool ${toolName}`
      };
    }
  });
}
