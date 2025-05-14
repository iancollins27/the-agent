
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
    let toolModule;
    try {
      toolModule = await import(`./${mappedToolName}/index.ts`);
      console.log(`Successfully imported tool module: ${mappedToolName}`);
    } catch (importError) {
      console.error(`Error importing tool module ${mappedToolName}:`, importError);
      throw new Error(`Failed to import tool module: ${importError.message}`);
    }
    
    // Create tool context
    const context: ToolContext = {
      supabase,
      userProfile,
      companyId
    };
    
    // Different tools might have their export structured differently
    const toolExports = {
      identify_project: toolModule.identifyProject,
      create_action_record: toolModule.createActionRecord,
      read_crm_data: toolModule.readCrmData,
      knowledge_base_lookup: toolModule.knowledgeBaseLookup
    };
    
    // Get the correct tool function
    const toolFunction = toolExports[toolName];
    
    if (!toolFunction) {
      console.error(`Tool function ${toolName} not found in module. Available exports:`, Object.keys(toolModule));
      throw new Error(`Tool function ${toolName} not found in module ${mappedToolName}`);
    }
    
    if (!toolFunction.execute) {
      console.error(`Tool function ${toolName} does not have an execute method. Keys:`, Object.keys(toolFunction));
      throw new Error(`Tool function ${toolName} does not have an execute method`);
    }
    
    console.log(`Executing tool function ${toolName}.execute with args`);
    const result = await toolFunction.execute(args, context);
    console.log(`Tool ${toolName} result:`, JSON.stringify(result).substring(0, 200) + (JSON.stringify(result).length > 200 ? '...' : ''));
    return result;
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      status: "error",
      error: error.message || "Unknown error",
      details: error.stack || "No stack trace available"
    };
  }
}
