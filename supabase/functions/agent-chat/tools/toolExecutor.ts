
/**
 * Execute tool calls
 */

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
    
    // Create tool context
    const context: ToolContext = {
      supabase,
      userProfile,
      companyId
    };
    
    // Different tools might have their export structured differently
    // Handle identify_project special case
    if (toolName === 'identify_project' && toolModule.identifyProject) {
      const result = await toolModule.identifyProject.execute(args, context);
      console.log(`Tool ${toolName} result:`, JSON.stringify(result).substring(0, 200) + (JSON.stringify(result).length > 200 ? '...' : ''));
      return result;
    }
    
    // Handle create_action_record special case
    if (toolName === 'create_action_record' && toolModule.createActionRecord) {
      const result = await toolModule.createActionRecord.execute(args, context);
      console.log(`Tool ${toolName} result:`, JSON.stringify(result).substring(0, 200) + (JSON.stringify(result).length > 200 ? '...' : ''));
      return result;
    }
    
    // For other tools, try the direct export match using the original name or converted name
    const toolFunction = toolModule[toolName] || toolModule[mappedToolName.replace(/-/g, '_')];
    
    if (toolFunction && toolFunction.execute) {
      const result = await toolFunction.execute(args, context);
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
