/**
 * Tool registry for agent-chat
 * Uses centralized tool definitions from _shared/tool-definitions
 */

import { 
  TOOL_DEFINITIONS, 
  getToolDefinitionsForLLM,
  ToolDefinition 
} from '../../_shared/tool-definitions/index.ts';

// Tools available to agent-chat
const AGENT_CHAT_TOOLS = [
  'create_action_record',
  'identify_project',
  'session_manager',
  'channel_response',
  'escalation',
  'crm_read',
  'crm_write',
  'knowledge_lookup'
];

// Create the toolRegistry object that agent-chat expects
export const toolRegistry = {
  getAllTools: () => AGENT_CHAT_TOOLS.map(name => TOOL_DEFINITIONS[name]).filter(Boolean),
  
  getToolNames: () => AGENT_CHAT_TOOLS,
  
  filterTools: (toolNames: string[]) => {
    const selectedTools = toolNames.filter(name => 
      AGENT_CHAT_TOOLS.includes(name) && name in TOOL_DEFINITIONS
    );
    
    console.log(`Filtered ${selectedTools.length} tools from ${toolNames.length} requested`);
    
    return getToolDefinitionsForLLM(selectedTools);
  },
  
  getToolDefinitions: () => {
    return getToolDefinitionsForLLM(AGENT_CHAT_TOOLS);
  },
  
  getFormattedToolDefinitions: () => {
    return AGENT_CHAT_TOOLS
      .filter(name => name in TOOL_DEFINITIONS)
      .map(name => {
        const def = TOOL_DEFINITIONS[name];
        const params = JSON.stringify(def.schema, null, 2);
        return `Tool: ${def.name}\nDescription: ${def.description}\nParameters: ${params}`;
      }).join('\n\n');
  }
};

// Keep backward compatibility exports
export function getToolNames(): string[] {
  return AGENT_CHAT_TOOLS;
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
