
/**
 * Common type definitions for all tools
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolHandler<TParams = any, TResult = any> {
  execute: (supabase: any, params: TParams, promptRunId: string, projectId: string) => Promise<TResult>;
  validate?: (params: TParams) => { valid: boolean; errors?: string[] };
}

export interface Tool<TParams = any, TResult = any> {
  definition: ToolDefinition;
  handler: ToolHandler<TParams, TResult>;
}

export interface ToolExecutionContext {
  supabase: any;
  promptRunId: string;
  projectId: string;
}

export interface ToolExecutionResult<T = any> {
  status: 'success' | 'error';
  result?: T;
  error?: string;
}

// Common status types for tools
export type ActionDecision = 
  | 'ACTION_NEEDED'
  | 'NO_ACTION'
  | 'SET_FUTURE_REMINDER'
  | 'REQUEST_HUMAN_REVIEW'
  | 'QUERY_KNOWLEDGE_BASE';

export type ActionPriority = 'high' | 'medium' | 'low';

export type ActionType = 
  | 'message'
  | 'data_update'
  | 'set_future_reminder'
  | 'human_in_loop'
  | 'knowledge_query';
