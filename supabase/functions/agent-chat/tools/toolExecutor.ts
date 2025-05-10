
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
    
    // Looking at the identify-project/index.ts file structure, the tool function
    // is likely exported as a named export inside an object, not as the direct function
    if (toolModule.identifyProject && toolName === 'identify_project') {
      // Create tool context
      const context: ToolContext = {
        supabase,
        userProfile,
        companyId
      };
      
      // Execute the tool
      const result = await toolModule.identifyProject.execute(args, context);
      console.log(`Tool ${toolName} result:`, JSON.stringify(result).substring(0, 200) + (JSON.stringify(result).length > 200 ? '...' : ''));
      return result;
    }
    
    // For other tools, try the direct export match
    if (toolModule[toolName]) {
      // Create tool context
      const context: ToolContext = {
        supabase,
        userProfile,
        companyId
      };
      
      // Execute the tool
      const result = await toolModule[toolName].execute(args, context);
      console.log(`Tool ${toolName} result:`, JSON.stringify(result).substring(0, 200) + (JSON.stringify(result).length > 200 ? '...' : ''));
      return result;
    }
    
    return {
      status: "error",
      error: `Tool function ${toolName} not found in module ${mappedToolName}`
    };
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      status: "error",
      error: error.message || "Unknown error"
    };
  }
}
