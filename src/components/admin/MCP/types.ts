
/**
 * Types for MCP Configuration components
 */

export interface ChatbotConfig {
  id: string;
  created_at: string;
  model: string;
  search_project_data: boolean;
  system_prompt: string;
  temperature: number;
  available_tools?: string[];
  mcp_tool_definitions?: string;
}

export interface ChatbotConfigUpdateInput {
  id?: string;
  created_at?: string;
  model?: string;
  search_project_data?: boolean;
  system_prompt?: string;
  temperature?: number;
  available_tools?: string[];
  mcp_tool_definitions?: string;
}

export interface ToolConfigCardProps {
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}
