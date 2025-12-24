/**
 * Security context types for tool invocation
 * This context is constructed by orchestrators and passed to tools for access control
 */

export interface ToolSecurityContext {
  /** Company ID - required for all tools to enforce data isolation */
  company_id: string;
  
  /** Supabase auth user ID (for admin/manager users via web interface) */
  user_id?: string;
  
  /** Contact ID (for customer-facing interactions via SMS/chat) */
  contact_id?: string;
  
  /** Type of user making the request */
  user_type: 'admin' | 'contact' | 'system';
  
  /** Pre-scoped project ID if known (e.g., after identify_project runs) */
  project_id?: string;
  
  /** Optional fine-grained permissions for future extensibility */
  permissions?: string[];
}

/**
 * Validation result for security context
 */
export interface SecurityValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a security context has the minimum required fields
 */
export function validateSecurityContext(
  context: ToolSecurityContext | undefined | null,
  options: { requireProject?: boolean; requireUser?: boolean } = {}
): SecurityValidationResult {
  if (!context) {
    return { valid: false, error: 'Security context is required' };
  }
  
  if (!context.company_id) {
    return { valid: false, error: 'company_id is required in security context' };
  }
  
  if (!context.user_type) {
    return { valid: false, error: 'user_type is required in security context' };
  }
  
  if (options.requireProject && !context.project_id) {
    return { valid: false, error: 'project_id is required for this operation' };
  }
  
  if (options.requireUser && !context.user_id && !context.contact_id) {
    return { valid: false, error: 'user_id or contact_id is required for this operation' };
  }
  
  return { valid: true };
}
