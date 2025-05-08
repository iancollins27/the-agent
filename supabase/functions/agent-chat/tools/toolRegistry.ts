
/**
 * Tool registry for Chat MCP tools
 */

import { Tool } from './types.ts';
import { identifyProject } from './identify-project/index.ts';

const tools: Record<string, Tool> = {
  identify_project: identifyProject,
  // Additional tools will be registered here in the future
};

export function getAvailableTools(): Record<string, Tool> {
  return tools;
}

export function getTool(name: string): Tool | undefined {
  return tools[name];
}

export function getToolNames(): string[] {
  return Object.keys(tools);
}

export function getToolDefinitions(): Array<{
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  };
}> {
  return Object.values(tools).map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema
    }
  }));
}
