
/**
 * Model Context Protocol (MCP) utilities
 */
import { getToolDefinitionsByNames } from './tools/registry.ts';

/**
 * Creates a new MCP conversation context
 */
export function createMCPContext(systemPrompt: string, userMessage: string, availableTools?: any[]): any {
  return {
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userMessage
      }
    ],
    tools: availableTools || []
  };
}

/**
 * Gets the default tools for MCP
 */
export function getDefaultTools() {
  // Define the default tools available to MCP
  return getToolDefinitionsByNames(['detect_action', 'create_action_record']);
}

/**
 * Adds a tool result to the conversation context
 */
export function addToolResult(context: any, toolCallId: string, toolName: string, result: any): any {
  // Copy the context to avoid mutation
  const newContext = {
    messages: [...context.messages],
    tools: context.tools
  };

  // Find the last assistant message with this tool call
  let assistantMessageIndex = -1;
  let assistantMessage = null;

  for (let i = newContext.messages.length - 1; i >= 0; i--) {
    const msg = newContext.messages[i];
    if (msg.role === "assistant" && msg.tool_calls) {
      const hasToolCall = msg.tool_calls.some((tc: any) => tc.id === toolCallId);
      if (hasToolCall) {
        assistantMessageIndex = i;
        assistantMessage = msg;
        break;
      }
    }
  }

  // If we didn't find the assistant message, create a new one
  if (assistantMessageIndex === -1) {
    assistantMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: toolCallId,
          type: "function",
          function: {
            name: toolName,
            arguments: typeof result === 'string' ? result : JSON.stringify(result)
          }
        }
      ]
    };
    newContext.messages.push(assistantMessage);
  }

  // Add the tool response message
  newContext.messages.push({
    role: "tool",
    tool_call_id: toolCallId,
    content: typeof result === 'string' ? result : JSON.stringify(result)
  });

  return newContext;
}

/**
 * Extracts tool calls from OpenAI's response format
 */
export function extractToolCallsFromOpenAI(message: any) {
  if (!message.tool_calls) {
    return [];
  }

  return message.tool_calls.map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tryParseJSON(tc.function.arguments, tc.function.arguments)
  }));
}

/**
 * Try to parse JSON, return the original string if parsing fails
 */
function tryParseJSON(jsonString: string, defaultValue: any = {}) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return defaultValue;
  }
}
