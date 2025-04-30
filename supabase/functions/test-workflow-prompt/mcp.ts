
import { getMCPOrchestratorPrompt } from "./mcp-system-prompts.ts";

export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
};

export interface MCPContext {
  messages: Message[];
  tools: Tool[];
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export function createMCPContext(systemPrompt: string, userPrompt: string, tools: Tool[]): MCPContext {
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
    tools
  };
}

export function addToolResult(context: MCPContext, toolName: string, result: any): MCPContext {
  // Find the last assistant message with a tool call for this tool
  const assistantMessages = context.messages.filter(m => m.role === "assistant");
  const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
  
  if (!lastAssistantMessage || !lastAssistantMessage.tool_call_id) {
    console.warn("No assistant message with tool call found");
    return context;
  }
  
  // Add the tool result
  const newMessages = [...context.messages, {
    role: "tool",
    content: typeof result === "string" ? result : JSON.stringify(result),
    name: toolName,
    tool_call_id: lastAssistantMessage.tool_call_id
  }];
  
  return {
    ...context,
    messages: newMessages
  };
}

export function addAssistantMessage(context: MCPContext, message: string): MCPContext {
  return {
    ...context,
    messages: [...context.messages, {
      role: "assistant",
      content: message
    }]
  };
}

export function extractToolCallsFromOpenAI(response: any): any[] {
  const toolCalls = response?.choices?.[0]?.message?.tool_calls || [];
  return toolCalls.map((toolCall: any) => ({
    id: toolCall.id,
    name: toolCall.function.name,
    arguments: JSON.parse(toolCall.function.arguments)
  }));
}

export function extractToolCallsFromClaude(response: any): any[] {
  const toolCalls = [];
  
  try {
    const content = response?.content || [];
    for (const item of content) {
      if (item.type === 'tool_use') {
        toolCalls.push({
          id: item.id,
          name: item.tool_use.name,
          arguments: item.tool_use.parameters
        });
      }
    }
  } catch (err) {
    console.error("Error extracting tool calls from Claude response:", err);
  }
  
  return toolCalls;
}

export function getDefaultTools(): Tool[] {
  return [
    {
      type: "function",
      function: {
        name: "detect_action",
        description: "Analyzes project context to determine if action is needed, postponed, or unnecessary. This should always be your first tool.",
        parameters: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              enum: [
                "ACTION_NEEDED",
                "NO_ACTION",
                "SET_FUTURE_REMINDER",
                "REQUEST_HUMAN_REVIEW",
                "QUERY_KNOWLEDGE_BASE"
              ],
              description: "The decision about what course of action to take"
            },
            reason: {
              type: "string",
              description: "Detailed explanation of your decision-making process and reasoning"
            },
            priority: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "The priority level of the action or reminder"
            },
            days_until_check: {
              type: "integer",
              description: "If decision is SET_FUTURE_REMINDER, number of days until the reminder"
            },
            check_reason: {
              type: "string",
              description: "If decision is SET_FUTURE_REMINDER, reason for the reminder"
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
        description: "Creates a specific action record for team members to execute based on the project's needs. Only use after detect_action confirms ACTION_NEEDED.",
        parameters: {
          type: "object",
          properties: {
            action_type: {
              type: "string",
              enum: ["message", "data_update", "reminder", "human_review"],
              description: "The type of action to be taken"
            },
            description: {
              type: "string",
              description: "Detailed description of what needs to be done"
            },
            recipient: {
              type: "string",
              description: "Who should receive this action (name, role, or contact ID)"
            },
            sender: {
              type: "string",
              description: "Who is sending this action (name, role, or contact ID)"
            },
            message_text: {
              type: "string",
              description: "For message actions, the content of the message to send"
            }
          },
          required: ["action_type", "description"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "knowledge_base_lookup",
        description: "Searches the knowledge base for relevant information about the project",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to find relevant information"
            },
            project_id: {
              type: "string",
              description: "Optional project ID to limit the search scope"
            }
          },
          required: ["query"]
        }
      }
    }
  ];
}
