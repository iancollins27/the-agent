/**
 * Tool Invoker - Delegates tool execution to existing edge functions
 *
 * This module invokes existing tool edge functions with the appropriate
 * security context for multi-tenant isolation.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SecurityContext {
  company_id: string;
  user_type: 'system' | 'admin' | 'contact';
  user_id?: string;
  contact_id?: string;
  project_id?: string;
}

/**
 * Create Supabase client with service role
 */
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Invoke a tool edge function with security context
 */
export async function invokeToolFunction(
  functionName: string,
  args: Record<string, unknown>,
  securityContext: SecurityContext
): Promise<unknown> {
  console.log(`[Tool Invoker] Invoking ${functionName} with args:`, args);
  
  const supabase = getSupabaseClient();
  
  // Build the request body according to the tool edge-function contract.
  // Tool functions expect args nested under `args`.
  const requestBody = {
    args,
    // Include security context for access control
    securityContext,
    // Metadata for logging/debugging
    metadata: {
      orchestrator: 'tool-api-server',
      company_id: securityContext.company_id,
      timestamp: new Date().toISOString()
    }
  };

  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: requestBody
    });
    
    const duration = Date.now() - startTime;
    console.log(`[Tool Invoker] ${functionName} completed in ${duration}ms`);
    
    if (error) {
      console.error(`[Tool Invoker] ${functionName} returned error:`, error);
      throw new Error(`Tool function error: ${error.message || JSON.stringify(error)}`);
    }
    
    return data;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Tool Invoker] ${functionName} failed after ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Check if a tool is available and callable
 */
export function isToolAvailable(toolName: string, enabledTools: string[]): boolean {
  return enabledTools.includes(toolName);
}
