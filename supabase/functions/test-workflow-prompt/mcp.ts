/**
 * Model Context Protocol (MCP) implementation for structured AI interactions
 */

type MCPMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
};

type MCPTool = {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  return_value?: {
    type: string;
    properties?: Record<string, any>;
  };
};

export type MCPContext = {
  messages: MCPMessage[];
  tools?: MCPTool[];
};

export type ActionType = 'message' | 'data_update' | 'set_future_reminder' | 'human_in_loop' | 'knowledge_query';

// Core MCP tool definitions for our workflow
export const getDefaultTools = (): MCPTool[] => [
  {
    name: 'detect_action',
    description: 'Analyzes project context and determines if any action should be taken',
    parameters: {
      type: 'object',
      properties: {
        decision: {
          type: 'string',
          enum: [
            'ACTION_NEEDED',
            'NO_ACTION',
            'SET_FUTURE_REMINDER',
            'REQUEST_HUMAN_REVIEW',
            'QUERY_KNOWLEDGE_BASE'
          ]
        },
        reason: {
          type: 'string',
          description: 'Explanation of the decision'
        },
        action_type: {
          type: 'string',
          enum: ['message', 'data_update', 'set_future_reminder', 'human_in_loop', 'knowledge_query'],
          description: 'The type of action to perform'
        },
        days_until_check: {
          type: 'integer',
          description: 'Number of days until the next check (for SET_FUTURE_REMINDER)'
        },
        sender: {
          type: 'string', 
          description: 'The sender of the message (for message action)'
        },
        recipient: {
          type: 'string',
          description: 'The recipient of the message (for message action)'
        },
        message_text: {
          type: 'string',
          description: 'The message content (for message action)'
        },
        field_to_update: {
          type: 'string',
          description: 'The field to update (for data_update action)'
        },
        new_value: {
          type: 'string',
          description: 'The new value for the field (for data_update action)'
        },
        query: {
          type: 'string',
          description: 'The query to perform against the knowledge base'
        }
      },
      required: ['decision', 'reason']
    }
  },
  {
    name: 'knowledge_base_lookup',
    description: 'Searches the knowledge base for relevant information using semantic similarity',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant knowledge base entries'
        },
        top_k: {
          type: 'integer',
          description: 'Number of results to return (default: 5)',
          default: 5
        }
      },
      required: ['query']
    },
    return_value: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              content: { type: 'string' },
              url: { type: 'string' },
              similarity: { type: 'number' }
            }
          }
        }
      }
    }
  }
];

// Creates a new MCP context for an interaction
export function createMCPContext(
  systemPrompt: string,
  userPrompt: string,
  tools: MCPTool[] = []
): MCPContext {
  return {
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    tools: tools.length > 0 ? tools : undefined
  };
}

// Formats a tool call result to add to the MCP context
export function addToolResult(
  context: MCPContext,
  toolName: string,
  result: any
): MCPContext {
  return {
    ...context,
    messages: [
      ...context.messages,
      {
        role: 'tool',
        name: toolName,
        content: typeof result === 'string' ? result : JSON.stringify(result)
      }
    ]
  };
}

// Adds an assistant message to the MCP context
export function addAssistantMessage(
  context: MCPContext,
  content: string
): MCPContext {
  return {
    ...context,
    messages: [
      ...context.messages,
      {
        role: 'assistant',
        content
      }
    ]
  };
}

// Formats the MCP context for OpenAI API
export function formatForOpenAI(context: MCPContext): any {
  return {
    model: "gpt-4o",
    messages: context.messages,
    tools: context.tools ? context.tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    })) : undefined,
    tool_choice: context.tools && context.tools.length === 1 ? 
      { type: "function", function: { name: context.tools[0].name } } : "auto"
  };
}

// Formats the MCP context for Claude API
export function formatForClaude(context: MCPContext): any {
  // Claude has a different format for tools, so we need to adapt
  return {
    model: "claude-3-haiku-20240307",
    messages: context.messages,
    tools: context.tools ? context.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    })) : undefined
  };
}

// Extracts tool calls from OpenAI response
export function extractToolCallsFromOpenAI(response: any): any[] {
  if (!response.choices || !response.choices[0] || !response.choices[0].message) {
    return [];
  }
  
  const message = response.choices[0].message;
  if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
    return [];
  }
  
  return message.tool_calls.map(toolCall => ({
    name: toolCall.function.name,
    arguments: JSON.parse(toolCall.function.arguments)
  }));
}

// Extracts tool calls from Claude response
export function extractToolCallsFromClaude(response: any): any[] {
  if (!response.content || !Array.isArray(response.content)) {
    return [];
  }
  
  const toolCalls = response.content
    .filter(item => item.type === 'tool_use')
    .map(item => ({
      name: item.name,
      arguments: item.input
    }));
  
  return toolCalls;
}
