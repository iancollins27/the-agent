
/**
 * Execute tool calls
 */

import { getTool } from './toolRegistry.ts';
import { ToolContext } from './types.ts';

export async function executeToolCall(
  supabase: any, 
  toolName: string, 
  args: any,
  userProfile: any = null,
  companyId: string | null = null
) {
  // Convert underscores in tool names to hyphens for file path compatibility
  // This handles the mismatch between how OpenAI refers to tools (with underscores)
  // and how files are actually named (with hyphens)
  const mappedToolName = toolName.replace(/_/g, '-');
  
  try {
    console.log(`Executing tool ${toolName} (mapped to ${mappedToolName}) with args:`, JSON.stringify(args));
    
    // Import the tool dynamically based on the mapped name
    const toolModule = await import(`./${mappedToolName}/index.ts`);
    
    // The export from the tool file should match the original tool name (with underscores)
    const toolFunction = toolModule[toolName];
    
    if (!toolFunction) {
      return {
        status: "error",
        error: `Tool function ${toolName} not found in module ${mappedToolName}`
      };
    }
    
    // Create tool context
    const context: ToolContext = {
      supabase,
      userProfile,
      companyId
    };
    
    // Execute the tool
    const result = await toolFunction.execute(args, context);
    console.log(`Tool ${toolName} result:`, JSON.stringify(result).substring(0, 200) + (JSON.stringify(result).length > 200 ? '...' : ''));
    return result;
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      status: "error",
      error: error.message || "Unknown error"
    };
  }
}
