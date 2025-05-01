
/**
 * Tool executor - handles execution of tools with validation and error handling
 */
import { getToolByName } from './registry.ts';
import { logToolCall } from '../database/tool-logs.ts';

export async function executeToolCall(
  supabase: any, 
  toolName: string, 
  args: any, 
  promptRunId: string, 
  projectId: string
) {
  const toolCallId = `call_${Math.random().toString(36).substring(2, 15)}`;
  const startTime = Date.now();
  let status = 200;
  let result;
  let argsString;

  try {
    // Convert args to string for logging
    try {
      argsString = typeof args === 'string' ? args : JSON.stringify(args);
    } catch (e) {
      argsString = "Error stringifying args";
    }
    
    // Log the tool call before execution
    await logToolCall(supabase, promptRunId, toolName, toolCallId, argsString, "", 0, 0);

    // Get the tool implementation
    const tool = getToolByName(toolName);
    if (!tool) {
      status = 400;
      result = { 
        status: "error",
        error: `Unknown tool: ${toolName}`
      };
    } else {
      // Execute the tool
      try {
        // Parse arguments if they're a string
        const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
        
        // Validate arguments if validation function exists
        if (tool.handler.validate) {
          const validation = tool.handler.validate(parsedArgs);
          if (!validation.valid) {
            throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
          }
        }
        
        // Execute the tool
        result = await tool.handler.execute(supabase, parsedArgs, promptRunId, projectId);
      } catch (toolError) {
        console.error(`Error executing tool ${toolName}:`, toolError);
        status = 400;
        result = { 
          status: "error", 
          error: toolError.message || "Unknown error in tool execution"
        };
      }
    }
  } catch (error) {
    console.error(`Error handling tool ${toolName}:`, error);
    status = 500;
    result = {
      status: "error",
      error: error.message || "Unknown error"
    };
  }

  // Calculate duration
  const duration = Date.now() - startTime;
  
  // Log the result
  try {
    const resultString = typeof result === 'string' ? result : JSON.stringify(result);
    await logToolCall(
      supabase, 
      promptRunId, 
      toolName, 
      toolCallId, 
      argsString || "", 
      resultString, 
      status, 
      duration
    );
    console.log(`Logged tool call ${toolName} with ID ${toolCallId}`);
  } catch (logError) {
    console.error("Error logging tool call:", logError);
  }

  return result;
}
