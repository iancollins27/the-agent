
/**
 * Central registry of all available tools
 */
import { Tool, ToolDefinition } from './types';
import { detectActionTool } from './detect-action';
import { createActionRecordTool } from './create-action-record';

// Register all tools in the system
const toolRegistry: Record<string, Tool> = {
  detect_action: detectActionTool,
  create_action_record: createActionRecordTool,
};

export function getAvailableTools(): string[] {
  return Object.keys(toolRegistry);
}

export function getToolDefinitions(): ToolDefinition[] {
  return Object.values(toolRegistry).map(tool => tool.definition);
}

export function getToolDefinitionsByNames(toolNames: string[]): ToolDefinition[] {
  return toolNames
    .filter(name => toolRegistry[name])
    .map(name => toolRegistry[name].definition);
}

export function getToolByName(name: string): Tool | undefined {
  return toolRegistry[name];
}

/**
 * Helper to format tool definitions into a readable string
 */
export function formatToolDefinitions(toolNames: string[]): string {
  if (!toolNames || toolNames.length === 0) {
    return "No tools available.";
  }
  
  return toolNames
    .filter(name => toolRegistry[name])
    .map(name => {
      const tool = toolRegistry[name];
      return `- ${name}: ${tool.definition.description}`;
    })
    .join('\n');
}
