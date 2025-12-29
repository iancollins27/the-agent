/**
 * Tool executor for agent-chat orchestrator
 * Executes tools either via edge function invocation or in-process fallback
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  buildContactSecurityContext, 
  buildAdminSecurityContext,
  ToolRequest,
  ToolResponse 
} from '../../_shared/tool-types/index.ts';
import { getEdgeFunctionName } from '../../_shared/tool-definitions/index.ts';
// Legacy in-process imports for tools not yet migrated
import { dataFetchTool } from '../../_shared/tools/data-fetch/index.ts';
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
  'email_summary',
  'create_zoho_note'
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
  supabase: ReturnType<typeof createClient>,
  toolName: string,
  args: any,
  context: any
): Promise<ToolResponse> {
  const edgeFunctionName = getEdgeFunctionName(toolName);
  
  if (!edgeFunctionName) {
    console.error(`[toolExecutor] No edge function mapping for tool: ${toolName}`);
    return {
      status: 'error',
      error: `No edge function mapping for tool: ${toolName}`
    };
  }

  // Build security context based on auth context
  let securityContext;
  if (context.authenticatedContact?.id) {
    // Contact-based authentication (SMS/chat)
    securityContext = buildContactSecurityContext(
      context.companyId,
      context.authenticatedContact.id,
      context.projectId
    );
  } else if (context.userProfile?.id) {
    // Admin user authentication
    securityContext = buildAdminSecurityContext(
      context.companyId,
      context.userProfile.id,
      context.projectId
    );
  } else {
    // System context fallback
    securityContext = {
      company_id: context.companyId,
      user_type: 'system' as const,
      project_id: context.projectId
    };
  }

  const request: ToolRequest = {
    securityContext,
    args,
    metadata: {
      orchestrator: 'agent-chat',
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

/**
 * Execute a tool in-process (legacy fallback for non-migrated tools)
 */
async function executeToolInProcess(
  toolName: string,
  args: any,
  context: any
): Promise<any> {
  switch (toolName) {
    case 'data_fetch':
      return await dataFetchTool.execute(args, context);
    default:
      throw new Error(`Unknown tool or not available in-process: ${toolName}`);
  }
}

/**
 * Main tool execution function
 */
export async function executeToolCall(
  supabase: ReturnType<typeof createClient>, 
  toolName: string, 
  args: any,
  userProfile: any,
  companyId: string | null
) {
  const context = {
    supabase,
    userProfile,
    companyId,
    userId: userProfile?.id
  };

  console.log(`[toolExecutor] Executing tool ${toolName}`);
  
  if (shouldUseEdgeFunction(toolName)) {
    return await invokeToolEdgeFunction(supabase, toolName, args, context);
  } else {
    return await executeToolInProcess(toolName, args, context);
  }
}

/**
 * Tool executor object that agent-chat expects
 */
export const toolExecutor = {
  executeTool: async (toolName: string, args: any, context: any) => {
    // Enhanced context handling for contact-based authentication
    const enhancedContext = {
      ...context,
      authenticatedContact: context.authenticatedContact || null,
      authContext: context.authContext || 'web'
    };

    console.log(`[toolExecutor] Tool execution context:`, {
      toolName,
      authContext: enhancedContext.authContext,
      userProfile: enhancedContext.userProfile?.id,
      companyId: enhancedContext.companyId,
      projectId: enhancedContext.projectId,
      contactId: enhancedContext.authenticatedContact?.id,
      useEdgeFunction: shouldUseEdgeFunction(toolName)
    });

    if (shouldUseEdgeFunction(toolName)) {
      return await invokeToolEdgeFunction(
        enhancedContext.supabase,
        toolName,
        args,
        enhancedContext
      );
    } else {
      return await executeToolInProcess(toolName, args, enhancedContext);
    }
  }
};
