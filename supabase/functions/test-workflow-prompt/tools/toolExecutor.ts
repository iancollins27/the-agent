
/**
 * Execute tool calls using the registry
 */

import { getTool } from './toolRegistry.ts';
import { logToolCall } from '../database/tool-logs.ts';
import { ToolContext } from './types.ts';

// Authorization check function
async function authorizeToolAccess(
  supabase: any,
  toolName: string,
  companyId: string | undefined,
  userProfile: any | undefined,
  projectId: string
): Promise<boolean> {
  // No authorization if we don't have company ID (system-initiated execution)
  if (!companyId) {
    console.log(`No companyId provided - assuming system execution for tool ${toolName}`);
    return true;
  }

  // For user-initiated executions, verify user belongs to company
  if (userProfile) {
    const userCompanyId = userProfile.company_id;
    
    if (userCompanyId !== companyId) {
      console.error(`Authorization failure: User company ID (${userCompanyId}) doesn't match provided company ID (${companyId})`);
      return false;
    }
    
    console.log(`User ${userProfile.id} authorized for company ${companyId}`);
    
    // If projectId is provided, verify project belongs to company
    if (projectId) {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('company_id')
        .eq('id', projectId)
        .single();
      
      if (projectError || !projectData) {
        console.error(`Project verification failed for ${projectId}: ${projectError?.message || 'Project not found'}`);
        return false;
      }
      
      if (projectData.company_id !== companyId) {
        console.error(`Project ${projectId} doesn't belong to company ${companyId}`);
        return false;
      }
      
      console.log(`Project ${projectId} verified for company ${companyId}`);
    }
  }
  
  return true;
}

export async function executeToolCall(
  supabase: any, 
  toolName: string, 
  args: any, 
  promptRunId: string, 
  projectId: string,
  companyId?: string,
  userProfile?: any
) {
  const tool = getTool(toolName);
  if (!tool) {
    console.error(`Unknown tool requested: ${toolName}`);
    return {
      status: "error",
      error: `Unknown tool: ${toolName}`
    };
  }
  
  // Create tool context with company ID for access control
  const context: ToolContext = {
    supabase,
    promptRunId,
    projectId,
    companyId,
    userProfile
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
    
    console.log(`Executing tool ${toolName} with args: ${argsString.substring(0, 100)}${argsString.length > 100 ? '...' : ''}`);
    
    // Perform authorization check before execution
    if (companyId) {
      const isAuthorized = await authorizeToolAccess(supabase, toolName, companyId, userProfile, projectId);
      if (!isAuthorized) {
        const authError = {
          status: "error",
          error: "Unauthorized access",
          details: "You don't have permission to use this tool with the provided data"
        };
        
        // Log the unauthorized attempt
        await logToolCall(
          supabase, 
          promptRunId, 
          toolName, 
          toolCallId, 
          argsString, 
          JSON.stringify(authError), 
          403, 
          Date.now() - startTime
        );
        
        return authError;
      }
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
    
    console.log(`Tool ${toolName} completed in ${duration}ms with status: ${result.status || 'unknown'}`);
    
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
      error: error.message || "Unknown error",
      details: error.stack || "No stack trace available"
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
