
/**
 * Model Context Protocol (MCP) implementation
 */

// Define types for MCP context and tool calls
export type MCPContext = {
  messages: any[];
  tools: any[];
};

// Create the initial MCP context with system prompt and user message
export function createMCPContext(systemPrompt: string, userPrompt: string, tools: any[]): MCPContext {
  return {
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    tools: tools
  };
}

// Extract tool calls from the OpenAI assistant message
export function extractToolCallsFromOpenAI(message: any): Array<{id: string, name: string, arguments: any}> {
  if (!message.tool_calls || message.tool_calls.length === 0) {
    console.error("No tool calls found in message");
    return [];
  }

  return message.tool_calls.map((toolCall: any) => {
    try {
      // Extract and parse the arguments
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        args = toolCall.function.arguments;
      }

      return {
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: args
      };
    } catch (e) {
      console.error("Error extracting tool call:", e);
      return {
        id: toolCall.id || "unknown",
        name: "error",
        arguments: { error: "Failed to parse arguments" }
      };
    }
  });
}

// Extract tool calls from Claude API responses
export function extractToolCallsFromClaude(data: any): Array<{id: string, name: string, arguments: any}> {
  if (!data || !data.content || !Array.isArray(data.content)) {
    console.error("Invalid Claude API response format");
    return [];
  }
  
  // Find any tool_use blocks in the content
  const toolUse = data.content.find((item: any) => 
    item.type === 'tool_use'
  );
  
  if (!toolUse) {
    return [];
  }
  
  try {
    return [{
      id: toolUse.id || `claude-tool-${Date.now()}`,
      name: toolUse.name,
      arguments: toolUse.input
    }];
  } catch (e) {
    console.error("Error extracting Claude tool call:", e);
    return [];
  }
}

// Add a tool result back to the MCP context
export function addToolResult(context: MCPContext, toolCallId: string, toolName: string, result: any): MCPContext {
  // Create a copy of the context
  const updatedContext = {
    messages: [...context.messages],
    tools: [...context.tools]
  };

  // Find the last assistant message to see if it contains the tool call
  const lastAssistantMessageIndex = updatedContext.messages.findLastIndex(msg => 
    msg.role === 'assistant'
  );

  // Check if we need to add an assistant message with the tool call
  const hasToolCall = lastAssistantMessageIndex >= 0 && 
    updatedContext.messages[lastAssistantMessageIndex].tool_calls && 
    updatedContext.messages[lastAssistantMessageIndex].tool_calls.some((call: any) => call.id === toolCallId);
  
  if (!hasToolCall) {
    // We need to add a proper assistant message with the tool call before adding the tool response
    updatedContext.messages.push({
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
    });
  }

  // Now add the tool response message
  updatedContext.messages.push({
    role: "tool",
    tool_call_id: toolCallId,
    name: toolName,
    content: typeof result === 'string' ? result : JSON.stringify(result)
  });

  return updatedContext;
}

// Get the default tools definition
export function getDefaultTools(): any[] {
  return [
    {
      type: "function",
      function: {
        name: "detect_action",
        description: "Analyzes project context to determine if any action is needed, postponed, or unnecessary",
        parameters: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              enum: ["ACTION_NEEDED", "NO_ACTION", "SET_FUTURE_REMINDER", "REQUEST_HUMAN_REVIEW", "QUERY_KNOWLEDGE_BASE"],
              description: "Decision on what to do next"
            },
            reason: {
              type: "string",
              description: "Explanation for the decision"
            },
            priority: {
              type: "string", 
              enum: ["high", "medium", "low"],
              description: "Priority of the action or task"
            },
            days_until_check: {
              type: "number",
              description: "If SET_FUTURE_REMINDER, days until we should check again"
            },
            check_reason: {
              type: "string",
              description: "Reason to check in the future"
            }
          },
          required: ["decision", "reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_action_record",
        description: "Creates a record of an action that needs to be taken",
        parameters: {
          type: "object",
          properties: {
            action_type: {
              type: "string",
              description: "Type of action to create"
            },
            description: {
              type: "string",
              description: "Description of the action"
            },
            recipient: {
              type: "string",
              description: "Role or person who should receive this action"
            },
            sender: {
              type: "string",
              description: "Role or person who is sending this action"
            },
            message_text: {
              type: "string",
              description: "Text content of message if this is a communication action"
            },
            decision: {
              type: "string",
              description: "The decision that led to this action (ACTION_NEEDED, etc)"
            }
          },
          required: ["action_type", "description", "recipient", "sender"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "knowledge_base_lookup",
        description: "Searches the knowledge base for relevant information",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query"
            },
            project_id: {
              type: "string",
              description: "Optional project ID to limit scope"
            }
          },
          required: ["query"]
        }
      }
    }
  ];
}
