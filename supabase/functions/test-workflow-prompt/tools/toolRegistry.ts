/**
 * Tool registry for MCP tools
 */

import { Tool } from './types.ts';
import { createActionRecordTool } from './create-action-record/index.ts';
import { knowledgeBaseLookup } from './knowledge-base-lookup/index.ts';
import { readCrmDataTool } from './read-crm-data/index.ts';
import { crmDataWrite } from './crm-data-write/index.ts';
import { emailSummaryTool } from './email-summary/index.ts';

const tools: Record<string, Tool> = {
  create_action_record: createActionRecordTool,
  knowledge_base_lookup: knowledgeBaseLookup,
  read_crm_data: readCrmDataTool,
  crm_data_write: crmDataWrite,
  email_summary: emailSummaryTool
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
  // If no tools are specified, return all tools
  if (!enabledTools || enabledTools.length === 0) {
    console.log("No tools specified in filterTools, returning all tools");
    return getToolDefinitions();
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
  
  console.log(`Found ${filtered.length} matching tools`);
  
  // If no tools were found but some were requested, return at least the core tools
  if (filtered.length === 0 && enabledTools.length > 0) {
    console.log("No matching tools found, defaulting to core tools");
    const coreTools = ['create_action_record', 'read_crm_data'];
    return Object.values(tools)
      .filter(tool => coreTools.includes(tool.name))
      .map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.schema
        }
      }));
  }
  
  return filtered;
}
