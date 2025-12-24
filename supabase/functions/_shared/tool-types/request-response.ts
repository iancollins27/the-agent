/**
 * Standardized request and response types for tool edge functions
 */

import { ToolSecurityContext } from './security-context.ts';

/**
 * Standard request format for all tool edge functions
 */
export interface ToolRequest<TArgs = Record<string, unknown>> {
  /** Security context constructed by the orchestrator */
  securityContext: ToolSecurityContext;
  
  /** Tool-specific arguments matching the tool's schema */
  args: TArgs;
  
  /** Optional metadata for tracing and debugging */
  metadata?: ToolRequestMetadata;
}

/**
 * Metadata attached to tool requests for tracing
 */
export interface ToolRequestMetadata {
  /** ID of the prompt run that triggered this tool call */
  prompt_run_id?: string;
  
  /** Trace ID for distributed tracing */
  trace_id?: string;
  
  /** Name of the orchestrator that invoked this tool */
  orchestrator: string;
  
  /** Timestamp of when the request was created */
  timestamp?: string;
}

/**
 * Standard response format for all tool edge functions
 */
export interface ToolResponse<TData = Record<string, unknown>> {
  /** Status of the tool execution */
  status: 'success' | 'error' | 'no_action';
  
  /** Tool-specific response data (on success) */
  data?: TData;
  
  /** Error message (on error) */
  error?: string;
  
  /** Human-readable message about what happened */
  message?: string;
  
  /** Optional metadata for debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Helper to create a success response
 */
export function successResponse<T>(data: T, message?: string): ToolResponse<T> {
  return {
    status: 'success',
    data,
    message
  };
}

/**
 * Helper to create an error response
 */
export function errorResponse(error: string, message?: string): ToolResponse {
  return {
    status: 'error',
    error,
    message: message || error
  };
}

/**
 * Helper to create a no-action response
 */
export function noActionResponse(message: string): ToolResponse {
  return {
    status: 'no_action',
    message
  };
}
