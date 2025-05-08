
/**
 * Type definitions for MCP context management
 */

export interface MCPContextManager {
  messages: any[];
  tools: any[];
  processResponse: (response: any, supabase: any, userProfile: any, companyId: string | null) => Promise<{
    finalAnswer: string;
    actionRecordId: string | null;
    projectData: any;
    processedToolCallIds: Set<string>;
  }>;
  addSystemMessage: (content: string) => void;
}

export interface ProjectData {
  id: string;
  crm_id?: string;
  summary?: string;
  next_step?: string;
  address?: string;
  status?: string;
  company?: string;
}
