/**
 * Tool configuration for test-workflow-prompt orchestrator
 * Defines which tools are available and provides utility functions
 */

import { TOOL_DEFINITIONS, getToolDefinitionsForLLM, getEdgeFunctionName } from '../_shared/tool-definitions/index.ts';

/**
 * Tools enabled for the test-workflow-prompt orchestrator
 * This orchestrator is admin-facing and handles workflow automation
 */
export const ENABLED_TOOLS = [
  'create_action_record',
  'crm_read',
  'crm_write',
  'knowledge_lookup',
  'email_summary'
] as const;

export type EnabledTool = typeof ENABLED_TOOLS[number];

/**
 * Get tool definitions formatted for LLM function calling
 */
export function getToolsForLLM() {
  return getToolDefinitionsForLLM([...ENABLED_TOOLS]);
}

/**
 * Get the edge function name for a tool
 */
export function getToolEdgeFunction(toolName: string): string | null {
  return getEdgeFunctionName(toolName);
}

/**
 * Check if a tool is enabled for this orchestrator
 */
export function isToolEnabled(toolName: string): boolean {
  return ENABLED_TOOLS.includes(toolName as EnabledTool);
}

/**
 * Get all enabled tool names
 */
export function getEnabledToolNames(): string[] {
  return [...ENABLED_TOOLS];
}
