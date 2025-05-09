
/**
 * Tool registry for Chat MCP tools
 */

import { Tool } from './types.ts';
import { identifyProject } from './identify-project/index.ts';
import { dataFetch } from './data-fetch/index.ts';

const tools: Record<string, Tool> = {
  identify_project: identifyProject,
  data_fetch: dataFetch
  // Additional tools will be registered here in the future
};

export function getAvailableTools(): Record<string, Tool> {
  return tools;
}

export function getTool(name: string): Tool | undefined {
  console.log(`Getting tool: ${name}, available: ${Object.keys(tools).includes(name)}`);
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
  console.log(`Getting tool definitions for ${Object.keys(tools).length} tools`);
  return Object.values(tools).map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema
    }
  }));
}

/**
 * Filter tools based on enabled tool names
 * @param enabledTools List of enabled tool names
 * @returns Filtered list of tool definitions
 */
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
  // If no tools are specified, return default tools
  if (!enabledTools || enabledTools.length === 0) {
    console.log("No tools specified in filterTools, returning default tools");
    return getToolDefinitions().filter(tool => 
      tool.function.name === 'identify_project' || 
      tool.function.name === 'data_fetch'
    );
  }

  // Log which tools we're looking for
  console.log(`Filtering for tools: ${enabledTools.join(', ')}`);
  
  // Return only tools that are enabled
  const filtered = Object.values(tools)
    .filter(tool => enabledTools.includes(tool.name))
    .map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      }
    }));
  
  console.log(`Found ${filtered.length} matching tools from ${enabledTools.length} requested`);
  
  // If no tools were found but some were requested, return default tools
  if (filtered.length === 0 && enabledTools.length > 0) {
    console.log("No matching tools found, defaulting to core tools");
    return getToolDefinitions().filter(tool => 
      tool.function.name === 'identify_project' || 
      tool.function.name === 'data_fetch'
    );
  }
  
  return filtered;
}
