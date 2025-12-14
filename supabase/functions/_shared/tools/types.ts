
/**
 * Unified types for shared MCP tools
 * Used by both agent-chat and test-workflow-prompt functions
 */

export interface ToolContext {
  supabase: any;
  userProfile?: any;
  companyId?: string;
  promptRunId?: string;  // Optional - used by workflow prompts
  projectId?: string;    // Optional - can also be passed in args
}

export interface Tool {
  name: string;
  description: string;
  schema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  execute: (args: any, context: ToolContext) => Promise<any>;
  validate?: (args: any) => boolean | { valid: boolean; errors?: string[] };
}

export interface ToolResult {
  status: "success" | "error" | "no_action";
  [key: string]: any;
}
