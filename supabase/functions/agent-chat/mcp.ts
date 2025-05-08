
/**
 * Model Context Protocol (MCP) utilities for the agent-chat
 */

import { getToolDefinitions } from './tools/toolRegistry.ts';

/**
 * Create a context object for the MCP conversation
 */
export function createMCPContext(systemPrompt: string, userPrompt: string, tools: any[] = []) {
  return {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    tools: tools
  };
}

/**
 * Add a tool result to the context
 */
export function addToolResult(context: any, toolId: string, toolName: string, result: any) {
  // Format result to string if needed
  const resultString = typeof result === 'string' ? result : JSON.stringify(result);
  
  // Find if this assistant message already exists in the context
  let assistantMessageIndex = context.messages.findIndex(m => 
    m.role === 'assistant' && 
    m.tool_calls && 
    m.tool_calls.some(tc => tc.id === toolId)
  );

  if (assistantMessageIndex !== -1) {
    // The assistant message already exists, so we should just add the tool response
    // First check if the tool response already exists
    const toolResponseExists = context.messages.some(m => 
      m.role === 'tool' && 
      m.tool_call_id === toolId
    );
    
    if (!toolResponseExists) {
      // Only add the tool response if it doesn't already exist
      context.messages.push({
        role: 'tool',
        tool_call_id: toolId,
        content: resultString
      });
    } else {
      console.log(`Tool response for tool_call_id ${toolId} already exists, skipping duplicate`);
    }
  } else {
    // Add the tool call as a new message to the context
    // First check if we're already adding a duplicate
    const duplicateCall = context.messages.some(m => 
      m.role === 'assistant' && 
      m.tool_calls && 
      m.tool_calls.some(tc => 
        tc.function && 
        tc.function.name === toolName && 
        // Compare only if we have arguments
        (tc.function.arguments ? tc.function.arguments === JSON.stringify({}) : true)
      )
    );
    
    if (!duplicateCall) {
      // Add assistant message with tool call
      context.messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: toolId,
            type: 'function',
            function: {
              name: toolName,
              arguments: JSON.stringify({}),  // This is ignored, but needed for the format
            }
          }
        ]
      });
      
      // Add the corresponding tool response message immediately after
      context.messages.push({
        role: 'tool',
        tool_call_id: toolId,
        content: resultString
      });
    } else {
      console.log(`Duplicate assistant message for tool ${toolName} detected, skipping`);
    }
  }
  
  return context;
}

/**
 * Extract tool calls from an OpenAI response
 */
export function extractToolCallsFromOpenAI(message: any) {
  if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
    return [];
  }
  
  return message.tool_calls.map((tool: any) => {
    let args = {};
    try {
      args = JSON.parse(tool.function.arguments);
    } catch (e) {
      console.error(`Error parsing tool arguments: ${e.message}`);
      args = { error: "Failed to parse arguments" };
    }
    
    return {
      id: tool.id,
      name: tool.function.name,
      arguments: args
    };
  });
}
