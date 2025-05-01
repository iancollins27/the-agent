
/**
 * Execute tool calls using the registry
 */

import { getTool } from './toolRegistry.ts';
import { logToolCall } from '../database/tool-logs.ts';
import { ToolContext } from './types.ts';

export async function executeToolCall(
  supabase: any, 
  toolName: string, 
  args: any, 
  promptRunId: string, 
  projectId: string
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
    promptRunId,
    projectId
  };
  
  // Generate a consistent tool call ID
  const toolCallId = `call_${Math.random().toString(36).substring(2, 15)}`;
  const startTime = Date.now();
  let argsString = '';
  
  try {
    // Convert args to string for logging
    try {
      argsString = typeof args === 'string' ? args : JSON.stringify(args);
    } catch (e) {
      argsString = "Error stringifying args";
    }
    
    // Execute the tool first - don't log until we have results
    const result = await tool.execute(args, context);
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Format the result for logging
    let resultString = '';
    try {
      resultString = typeof result === 'string' ? result : JSON.stringify(result);
    } catch (e) {
      resultString = "Error stringifying result";
    }
    
    // Log the tool call with complete information - only log ONCE after execution
    await logToolCall(
      supabase, 
      promptRunId, 
      toolName, 
      toolCallId, 
      argsString, 
      resultString, 
      200, 
      duration
    );
    
    return result;
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    
    const duration = Date.now() - startTime;
    const errorResult = {
      status: "error",
      error: error.message || "Unknown error"
    };
    
    let errorResultString = '';
    try {
      errorResultString = JSON.stringify(errorResult);
    } catch (e) {
      errorResultString = `{"status":"error","error":"Failed to stringify error"}`;
    }
    
    // Only log once with the error information
    await logToolCall(
      supabase, 
      promptRunId, 
      toolName, 
      toolCallId, 
      argsString, 
      errorResultString, 
      500, 
      duration
    );
    
    return errorResult;
  }
}
