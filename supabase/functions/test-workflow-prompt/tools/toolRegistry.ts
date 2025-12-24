/**
 * Tool registry for test-workflow-prompt
 * Uses centralized tool definitions from _shared/tool-definitions
 */

import { 
  TOOL_DEFINITIONS, 
  getToolDefinitionsForLLM,
  ToolDefinition 
} from '../../_shared/tool-definitions/index.ts';

// Tools available to test-workflow-prompt
const WORKFLOW_TOOLS = [
  'create_action_record',
  'crm_read',
  'crm_write',
  'knowledge_lookup',
  'email_summary',
  'identify_project'
];

export function getAvailableTools(): Record<string, ToolDefinition> {
  const tools: Record<string, ToolDefinition> = {};
  WORKFLOW_TOOLS.forEach(name => {
    if (name in TOOL_DEFINITIONS) {
      tools[name] = TOOL_DEFINITIONS[name];
    }
  });
  return tools;
}

export function getTool(name: string): ToolDefinition | undefined {
  if (WORKFLOW_TOOLS.includes(name)) {
    return TOOL_DEFINITIONS[name];
  }
  return undefined;
}

export function getToolNames(): string[] {
  return WORKFLOW_TOOLS;
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
  return getToolDefinitionsForLLM(WORKFLOW_TOOLS);
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
  if (!enabledTools || enabledTools.length === 0) {
    console.log("No tools specified in filterTools, returning all tools");
    return getToolDefinitions();
  }

  console.log(`Filtering for tools: ${enabledTools.join(', ')}`);
  
  // Only include tools that are both requested and available to this workflow
  const validTools = enabledTools.filter(name => WORKFLOW_TOOLS.includes(name));
  const filtered = getToolDefinitionsForLLM(validTools);
  
  console.log(`Found ${filtered.length} matching tools`);
  
  if (filtered.length === 0 && enabledTools.length > 0) {
    console.log("No matching tools found, defaulting to core tools");
    return getToolDefinitionsForLLM(['create_action_record', 'crm_read']);
  }
  
  return filtered;
}
