
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
  const tool = getTool(toolName);
  if (!tool) {
    return {
      status: "error",
      error: `Unknown tool: ${toolName}`
    };
  }
  
  // Create tool context
  const context: ToolContext = {
    supabase,
    userProfile,
    companyId
  };
  
  try {
    console.log(`Executing tool ${toolName} with args:`, JSON.stringify(args));
    const result = await tool.execute(args, context);
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
