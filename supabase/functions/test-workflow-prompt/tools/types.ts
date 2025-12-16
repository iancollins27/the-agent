
/**
 * Common types for MCP tools
 */

export interface ToolContext {
  supabase: any;
  promptRunId: string;
  projectId: string;
  companyId?: string; // Added company ID for access control
  userProfile?: any; // Added user profile for authorization
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
