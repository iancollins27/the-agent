
/**
 * Tool registry for MCP tools
 */

import { Tool } from './types.ts';
import { detectAction } from './detect-action/index.ts';
import { createActionRecord } from './create-action-record/index.ts';
import { knowledgeBaseLookup } from './knowledge-base-lookup/index.ts';

const tools: Record<string, Tool> = {
  detect_action: detectAction,
  create_action_record: createActionRecord,
  knowledge_base_lookup: knowledgeBaseLookup,
  // Additional tools can be registered here
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

export function filterTools(enabledTools: string[]): Array<{
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
  return Object.values(tools)
    .filter(tool => enabledTools.includes(tool.name))
    .map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      }
    }));
}
