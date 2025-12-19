// Shared tools
import { createActionRecordTool } from '../../_shared/tools/create-action-record/index.ts';
import { dataFetchTool } from '../../_shared/tools/data-fetch/index.ts';
import { readCrmDataTool } from '../../_shared/tools/read-crm-data/index.ts';
import { appendCrmNoteTool } from '../../_shared/tools/append-crm-note/index.ts';
import { crmDataWriteTool } from '../../_shared/tools/crm-data-write/index.ts';

// Local tools (unique to agent-chat)
import { sessionManagerTool } from "./session-manager/index.ts";
import { channelResponseTool } from "./channel-response/index.ts";
import { escalationTool } from "./escalation/index.ts";
import { identifyProjectTool } from "./identify-project/index.ts";

// Register all available tools
const tools = [
  createActionRecordTool,
  dataFetchTool,
  readCrmDataTool,
  appendCrmNoteTool,
  crmDataWriteTool,
  sessionManagerTool,
  channelResponseTool,
  escalationTool,
  identifyProjectTool
];

// Create the toolRegistry object that agent-chat expects
export const toolRegistry = {
  getAllTools: () => tools,
  
  getToolNames: () => tools.map(tool => tool.name),
  
  filterTools: (toolNames: string[]) => {
    const selectedTools = tools.filter(tool => 
      toolNames.includes(tool.name)
    );
    
    console.log(`Filtered ${selectedTools.length} tools from ${tools.length} available`);
    
    return selectedTools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        // Handle both schema (shared tools) and parameters (local tools)
        parameters: (tool as any).schema || (tool as any).parameters
      }
    }));
  },
  
  getToolDefinitions: () => {
    return tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        // Handle both schema (shared tools) and parameters (local tools)
        parameters: (tool as any).schema || (tool as any).parameters
      }
    }));
  },
  
  getFormattedToolDefinitions: () => {
    return tools.map(tool => {
      // Handle both schema (shared tools) and parameters (local tools)
      const params = JSON.stringify((tool as any).schema || (tool as any).parameters, null, 2);
      return `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters: ${params}`;
    }).join('\n\n');
  }
};

// Keep backward compatibility exports
export function getToolNames(): string[] {
  return tools.map(tool => tool.name);
}

export function filterTools(toolNames: string[]) {
  return toolRegistry.filterTools(toolNames);
}

export function getToolDefinitions() {
  return toolRegistry.getToolDefinitions();
}

export function getFormattedToolDefinitions() {
  return toolRegistry.getFormattedToolDefinitions();
}
