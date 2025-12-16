
/**
 * Common types for Chat MCP tools
 */

export interface ToolContext {
  supabase: any;
  userProfile?: any;
  companyId?: string;
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
