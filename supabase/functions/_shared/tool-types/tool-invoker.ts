/**
 * Utility for invoking tool edge functions with standardized request/response
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ToolSecurityContext } from './security-context.ts';
import { ToolRequest, ToolResponse, ToolRequestMetadata } from './request-response.ts';
import { getEdgeFunctionName } from '../tool-definitions/index.ts';

/**
 * Invoke a tool edge function with standardized request format
 */
export async function invokeTool(
  toolName: string,
  args: Record<string, unknown>,
  securityContext: ToolSecurityContext,
  metadata?: Partial<ToolRequestMetadata>
): Promise<ToolResponse> {
  const edgeFunctionName = getEdgeFunctionName(toolName);
  
  if (!edgeFunctionName) {
    console.error(`[invokeTool] Unknown tool: ${toolName}`);
    return {
      status: 'error',
      error: `Unknown tool: ${toolName}`
    };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const request: ToolRequest = {
    securityContext,
    args,
    metadata: {
      orchestrator: metadata?.orchestrator || 'unknown',
      prompt_run_id: metadata?.prompt_run_id,
      trace_id: metadata?.trace_id,
      timestamp: new Date().toISOString()
    }
  };

  console.log(`[invokeTool] Invoking ${edgeFunctionName} for tool ${toolName}`);

  try {
    const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
      body: request
    });

    if (error) {
      console.error(`[invokeTool] Error invoking ${edgeFunctionName}:`, error);
      return {
        status: 'error',
        error: error.message || 'Tool invocation failed'
      };
    }

    return data as ToolResponse;
  } catch (err) {
    console.error(`[invokeTool] Exception invoking ${edgeFunctionName}:`, err);
    return {
      status: 'error',
      error: err.message || 'Tool invocation exception'
    };
  }
}

/**
 * Build security context for admin/system orchestrators
 */
export function buildSystemSecurityContext(
  companyId: string,
  projectId?: string
): ToolSecurityContext {
  return {
    company_id: companyId,
    user_type: 'system',
    project_id: projectId
  };
}

/**
 * Build security context for customer-facing orchestrators
 */
export function buildContactSecurityContext(
  companyId: string,
  contactId: string,
  projectId?: string
): ToolSecurityContext {
  return {
    company_id: companyId,
    contact_id: contactId,
    user_type: 'contact',
    project_id: projectId
  };
}

/**
 * Build security context for admin users
 */
export function buildAdminSecurityContext(
  companyId: string,
  userId: string,
  projectId?: string
): ToolSecurityContext {
  return {
    company_id: companyId,
    user_id: userId,
    user_type: 'admin',
    project_id: projectId
  };
}
