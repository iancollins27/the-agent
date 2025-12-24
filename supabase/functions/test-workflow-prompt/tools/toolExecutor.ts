/**
 * Tool executor for test-workflow-prompt orchestrator
 * Executes tools via edge function invocation with authorization and logging
 */

import { getTool } from './toolRegistry.ts';
import { logToolCall } from '../database/tool-logs.ts';
import { ToolContext } from './types.ts';
import { 
  buildSystemSecurityContext, 
  buildAdminSecurityContext,
  ToolRequest,
  ToolResponse 
} from '../../_shared/tool-types/index.ts';
import { getEdgeFunctionName } from '../../_shared/tool-definitions/index.ts';

/**
 * Tools that have been migrated to edge functions
 */
const EDGE_FUNCTION_TOOLS = [
  'identify_project',
  'session_manager', 
  'channel_response',
  'escalation',
  'create_action_record',
  'crm_read',
  'crm_write',
  'knowledge_lookup',
  'email_summary'
];

/**
 * Check if a tool should be executed via edge function
 */
function shouldUseEdgeFunction(toolName: string): boolean {
  return EDGE_FUNCTION_TOOLS.includes(toolName);
}

/**
 * Execute a tool via edge function invocation
 */
async function invokeToolEdgeFunction(
  supabase: any,
  toolName: string,
  args: any,
  context: ToolContext,
  promptRunId: string
): Promise<ToolResponse> {
  const edgeFunctionName = getEdgeFunctionName(toolName);
  
  if (!edgeFunctionName) {
    console.error(`[toolExecutor] No edge function mapping for tool: ${toolName}`);
    return {
      status: 'error',
      error: `No edge function mapping for tool: ${toolName}`
    };
  }

  // Build security context based on user profile
  let securityContext;
  if (context.userProfile?.id) {
    securityContext = buildAdminSecurityContext(
      context.companyId || '',
      context.userProfile.id,
      context.projectId
    );
  } else {
    securityContext = buildSystemSecurityContext(
      context.companyId || '',
      context.projectId
    );
  }

  const request: ToolRequest = {
    securityContext,
    args,
    metadata: {
      orchestrator: 'test-workflow-prompt',
      prompt_run_id: promptRunId,
      timestamp: new Date().toISOString()
    }
  };

  console.log(`[toolExecutor] Invoking edge function ${edgeFunctionName} for tool ${toolName}`);

  try {
    const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
      body: request
    });

    if (error) {
      console.error(`[toolExecutor] Edge function error for ${toolName}:`, error);
      return {
        status: 'error',
        error: error.message || 'Edge function invocation failed'
      };
    }

    return data as ToolResponse;
  } catch (err) {
    console.error(`[toolExecutor] Exception invoking ${edgeFunctionName}:`, err);
    return {
      status: 'error',
      error: err.message || 'Tool invocation exception'
    };
  }
}

// Authorization check function (used for in-process execution fallback)
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
    
    console.log(`[toolExecutor] Executing tool ${toolName} (edge function: ${shouldUseEdgeFunction(toolName)})`);
    
    let result;
    
    if (shouldUseEdgeFunction(toolName)) {
      // Execute via edge function
      const context: ToolContext = {
        supabase,
        promptRunId,
        projectId,
        companyId,
        userProfile
      };
      
      result = await invokeToolEdgeFunction(supabase, toolName, args, context, promptRunId);
    } else {
      // Fall back to in-process execution for non-migrated tools
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
      
      // Perform authorization check before execution (for in-process only)
      if (companyId) {
        const isAuthorized = await authorizeToolAccess(supabase, toolName, companyId, userProfile, projectId);
        if (!isAuthorized) {
          const authError = {
            status: "error",
            error: "Unauthorized access",
            details: "You don't have permission to use this tool with the provided data"
          };
          
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
      
      result = await tool.execute(args, context);
    }
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Format the result for logging
    let resultString = '';
    try {
      resultString = typeof result === 'string' ? result : JSON.stringify(result);
    } catch (e) {
      resultString = "Error stringifying result";
    }
    
    console.log(`[toolExecutor] Tool ${toolName} completed in ${duration}ms with status: ${result.status || 'unknown'}`);
    
    // Log the tool call
    await logToolCall(
      supabase, 
      promptRunId, 
      toolName, 
      toolCallId, 
      argsString, 
      resultString, 
      result.status === 'error' ? 500 : 200, 
      duration
    );
    
    return result;
  } catch (error) {
    console.error(`[toolExecutor] Error executing tool ${toolName}:`, error);
    
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
