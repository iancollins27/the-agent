
import { createActionRecordTool } from "./create-action-record/index.ts";
import { dataFetchTool } from "./data-fetch/index.ts";
import { identifyProjectTool } from "./identify-project/index.ts";
import { readCrmDataTool } from "./read-crm-data/index.ts";
import { sessionManagerTool } from "./session-manager/index.ts";
import { channelResponseTool } from "./channel-response/index.ts";

// Register all available tools
const tools = [
  createActionRecordTool,
  dataFetchTool,
  identifyProjectTool,
  readCrmDataTool,
  sessionManagerTool,
  channelResponseTool
];

// Get names of all available tools
export function getToolNames(): string[] {
  return tools.map(tool => tool.name);
}

// Filter tools by name
export function filterTools(toolNames: string[]) {
  const selectedTools = tools.filter(tool => 
    toolNames.includes(tool.name)
  );
  
  console.log(`Filtered ${selectedTools.length} tools from ${tools.length} available`);
  
  return selectedTools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema // Map schema to parameters for OpenAI API
    }
  }));
}

// Get full tool definitions
export function getToolDefinitions() {
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema // Map schema to parameters for OpenAI API
    }
  }));
}

// Get formatted tool definitions for insertion into prompts
export function getFormattedToolDefinitions() {
  return tools.map(tool => {
    const params = JSON.stringify(tool.schema, null, 2);
    return `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters: ${params}`;
  }).join('\n\n');
}
