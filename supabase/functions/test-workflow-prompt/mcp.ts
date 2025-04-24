
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
  // Ensure that both prompts are non-empty strings
  const sanitizedSystemPrompt = systemPrompt || "You are an AI assistant processing project data.";
  const sanitizedUserPrompt = userPrompt || "Please analyze the following data.";
  
  // Create a properly structured MCP context with messages array
  const context: MCPContext = {
    messages: [
      {
        role: 'system',
        content: sanitizedSystemPrompt
      },
      {
        role: 'user',
        content: sanitizedUserPrompt
      }
    ]
  };
  
  // Add tools only if they exist
  if (tools && tools.length > 0) {
    context.tools = tools;
  }
  
  return context;
}

// Formats a tool call result to add to the MCP context
export function addToolResult(
  context: MCPContext,
  toolName: string,
  result: any
): MCPContext {
  // Validate the context before proceeding
  if (!context || !context.messages) {
    console.error("Invalid MCP context provided to addToolResult");
    // Return a minimal valid context as fallback
    return {
      messages: [
        { role: 'system', content: 'System context was missing or invalid.' },
        { role: 'user', content: 'Please provide a valid response.' }
      ]
    };
  }
  
  // Create a new context with the tool result added
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
  // Validate the context before proceeding
  if (!context || !context.messages) {
    console.error("Invalid MCP context provided to addAssistantMessage");
    // Return a minimal valid context as fallback
    return {
      messages: [
        { role: 'system', content: 'System context was missing or invalid.' },
        { role: 'user', content: 'Please provide a valid response.' }
      ]
    };
  }
  
  // Create a new context with the assistant message added
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
  // Validate context before formatting
  if (!context.messages || context.messages.length === 0) {
    console.error("Invalid MCP context: missing or empty messages array");
    // Provide a fallback minimal context
    return {
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an AI assistant." },
        { role: "user", content: "Please provide a helpful response." }
      ]
    };
  }
  
  // Log the first few messages for debugging
  const messagesToLog = context.messages.slice(0, 3);
  console.log("First few messages:", JSON.stringify(messagesToLog, null, 2));
  console.log(`Total messages: ${context.messages.length}`);
  
  // Format the context for OpenAI
  const formatted = {
    model: "gpt-4o",
    messages: context.messages
  };
  
  // Add tools only if they exist
  if (context.tools && context.tools.length > 0) {
    formatted.tools = context.tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
    
    // Set tool choice if there's exactly one tool
    formatted.tool_choice = context.tools.length === 1 ? 
      { type: "function", function: { name: context.tools[0].name } } : "auto";
  }
  
  return formatted;
}

// Formats the MCP context for Claude API
export function formatForClaude(context: MCPContext): any {
  // Validate context before formatting
  if (!context.messages || context.messages.length === 0) {
    console.error("Invalid MCP context: missing or empty messages array for Claude");
    // Provide a fallback minimal context
    return {
      model: "claude-3-haiku-20240307",
      messages: [
        { role: "user", content: "Please provide a helpful response." }
      ]
    };
  }
  
  // Log the first few messages for debugging
  const messagesToLog = context.messages.slice(0, 3);
  console.log("First few messages for Claude:", JSON.stringify(messagesToLog, null, 2));
  console.log(`Total Claude messages: ${context.messages.length}`);
  
  // Format the context for Claude
  const formatted = {
    model: "claude-3-haiku-20240307",
    messages: context.messages
  };
  
  // Add tools only if they exist
  if (context.tools && context.tools.length > 0) {
    formatted.tools = context.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }
  
  return formatted;
}

// Extracts tool calls from OpenAI response
export function extractToolCallsFromOpenAI(response: any): any[] {
  if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
    console.error("Invalid OpenAI response format in extractToolCallsFromOpenAI");
    return [];
  }
  
  const message = response.choices[0].message;
  if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
    console.log("No tool calls found in OpenAI response");
    return [];
  }
  
  try {
    return message.tool_calls.map(toolCall => ({
      name: toolCall.function.name,
      arguments: JSON.parse(toolCall.function.arguments)
    }));
  } catch (error) {
    console.error("Error parsing tool call arguments:", error);
    return [];
  }
}

// Extracts tool calls from Claude response
export function extractToolCallsFromClaude(response: any): any[] {
  if (!response || !response.content || !Array.isArray(response.content)) {
    console.error("Invalid Claude response format in extractToolCallsFromClaude");
    return [];
  }
  
  const toolCalls = response.content
    .filter(item => item.type === 'tool_use')
    .map(item => {
      try {
        return {
          name: item.name,
          arguments: item.input
        };
      } catch (error) {
        console.error("Error processing Claude tool call:", error);
        return null;
      }
    })
    .filter(Boolean); // Remove nulls
  
  return toolCalls;
}
