/**
 * Model Context Protocol (MCP) implementation for structured AI interactions
 */

export type MCPMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
};

export type MCPTool = {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    examples?: Record<string, any>[];
  };
  return_value?: {
    type: string;
    properties?: Record<string, any>;
    examples?: Record<string, any>[];
  };
};

export type MCPContext = {
  messages: MCPMessage[];
  tools?: MCPTool[];
  memory?: MCPMemory;
};

export type MCPMemory = {
  conversationHistory: MCPMessage[];
  toolCallHistory: {
    toolName: string;
    args: any;
    result: any;
    timestamp: number;
  }[];
  projectContext?: Record<string, any>;
};

export type ActionType = 'message' | 'data_update' | 'set_future_reminder' | 'human_in_loop' | 'knowledge_query';

// Core MCP tool definitions for our workflow
export const getDefaultTools = (): MCPTool[] => [
  {
    name: 'detect_action',
    description: 'Analyzes project context and determines if any action should be taken based on the current state and recent updates',
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
          ],
          description: 'The decision on what action to take based on the project context'
        },
        reason: {
          type: 'string',
          description: 'Detailed explanation of the decision reasoning, including what specific aspects of the project context influenced this decision'
        },
        confidence: {
          type: 'number',
          description: 'A confidence score from 0.0 to 1.0 indicating how certain the agent is about this decision',
          minimum: 0,
          maximum: 1
        }
      },
      required: ['decision', 'reason'],
      examples: [
        {
          decision: "ACTION_NEEDED",
          reason: "The project has reached the roof installation completion milestone but requires final documentation to be submitted. Several days have passed without updates on this requirement.",
          confidence: 0.85
        },
        {
          decision: "NO_ACTION",
          reason: "The project is proceeding as planned with all current tasks on schedule. The next milestone is in 3 days with no immediate actions required.",
          confidence: 0.92
        }
      ]
    },
    return_value: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        result: { type: 'string' }
      },
      examples: [
        { success: true, result: 'Action detection successful' }
      ]
    }
  },
  {
    name: 'generate_action',
    description: 'Generates a specific action based on the project context when intervention is required',
    parameters: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          enum: ['message', 'data_update', 'set_future_reminder', 'human_in_loop', 'knowledge_query'],
          description: 'The type of action to perform'
        },
        days_until_check: {
          type: 'integer',
          description: 'Number of days until the next check (for SET_FUTURE_REMINDER)',
          minimum: 1,
          maximum: 90
        },
        sender: {
          type: 'string', 
          description: 'The sender of the message (for message action), should be one of the defined roles in the project track'
        },
        recipient: {
          type: 'string',
          description: 'The recipient of the message (for message action), should be one of the defined roles in the project track'
        },
        message_text: {
          type: 'string',
          description: 'The detailed message content (for message action)'
        },
        field_to_update: {
          type: 'string',
          description: 'The database field to update (for data_update action), e.g., "next_step", "summary"'
        },
        new_value: {
          type: 'string',
          description: 'The new value for the field (for data_update action)'
        },
        query: {
          type: 'string',
          description: 'The specific query to perform against the knowledge base (for knowledge_query action)'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'The priority level of this action'
        },
        description: {
          type: 'string',
          description: 'A human-readable description explaining the purpose and importance of this action'
        }
      },
      required: ['action_type', 'description'],
      examples: [
        {
          action_type: "message",
          sender: "BidList Project Manager",
          recipient: "Roofer",
          message_text: "Please submit the completed installation documentation by Friday. The final inspection is scheduled for Monday and we need these documents beforehand.",
          priority: "high",
          description: "Request missing documentation from roofer to proceed with final inspection"
        },
        {
          action_type: "set_future_reminder",
          days_until_check: 7,
          description: "Follow up in one week to verify permit approval status",
          priority: "medium"
        }
      ]
    },
    return_value: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        result: { type: 'string' },
        action_id: { type: 'string' }
      }
    }
  },
  {
    name: 'knowledge_base_lookup',
    description: 'Searches the project knowledge base for relevant information to inform decision making',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The specific search query to find relevant information in the knowledge base'
        },
        project_id: {
          type: 'string',
          description: 'The project ID to scope the knowledge base search'
        },
        filter_by_date: {
          type: 'boolean',
          description: 'Whether to prioritize recent information in search results'
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of results to return',
          minimum: 1,
          maximum: 10
        }
      },
      required: ['query', 'project_id'],
      examples: [
        {
          query: "permit requirements roof installation",
          project_id: "069251ac-5972-4772-9a14-6dc5a4fc67db",
          filter_by_date: true,
          max_results: 5
        }
      ]
    },
    return_value: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              relevance: { type: 'number' },
              source: { type: 'string' },
              date: { type: 'string' }
            }
          }
        }
      },
      examples: [
        {
          results: [
            {
              title: "Permit Requirements",
              content: "Final inspection requires submission of completed installation form, photos of completed work, and permit number.",
              relevance: 0.92,
              source: "County Guidelines",
              date: "2025-01-15"
            }
          ]
        }
      ]
    }
  },
  {
    name: 'analyze_timeline',
    description: 'Analyzes the project timeline to identify delays, upcoming milestones, and critical dates',
    parameters: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to analyze'
        },
        milestone_focus: {
          type: 'string',
          description: 'Optional specific milestone to focus analysis on'
        }
      },
      required: ['project_id'],
      examples: [
        {
          project_id: "069251ac-5972-4772-9a14-6dc5a4fc67db",
          milestone_focus: "roof installation"
        }
      ]
    },
    return_value: {
      type: 'object',
      properties: {
        current_phase: { type: 'string' },
        days_in_current_phase: { type: 'integer' },
        upcoming_milestones: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              expected_date: { type: 'string' },
              status: { type: 'string' }
            }
          }
        },
        delays: { 
          type: 'array', 
          items: { 
            type: 'object',
            properties: {
              milestone: { type: 'string' },
              expected_date: { type: 'string' },
              actual_date: { type: 'string' },
              days_delayed: { type: 'integer' }
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
  tools: MCPTool[] = [],
  memory: MCPMemory = {
    conversationHistory: [],
    toolCallHistory: []
  }
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
    tools: tools.length > 0 ? tools : undefined,
    memory: memory
  };
}

// Formats a tool call result to add to the MCP context
export function addToolResult(
  context: MCPContext,
  toolName: string,
  result: any
): MCPContext {
  // Add tool result as a message
  const updatedMessages = [
    ...context.messages,
    {
      role: 'tool',
      name: toolName,
      content: typeof result === 'string' ? result : JSON.stringify(result)
    }
  ];
  
  // Update memory if available
  let updatedMemory = context.memory;
  if (updatedMemory) {
    // Find the most recent tool call to update with results
    const toolCall = context.memory.toolCallHistory.find(tc => tc.toolName === toolName);
    if (toolCall) {
      toolCall.result = result;
    }
    
    // Add message to conversation history
    updatedMemory.conversationHistory.push({
      role: 'tool',
      name: toolName,
      content: typeof result === 'string' ? result : JSON.stringify(result)
    });
  }
  
  return {
    ...context,
    messages: updatedMessages,
    memory: updatedMemory
  };
}

// Adds an assistant message to the MCP context
export function addAssistantMessage(
  context: MCPContext,
  content: string
): MCPContext {
  const updatedMessages = [
    ...context.messages,
    {
      role: 'assistant',
      content
    }
  ];
  
  // Update memory if available
  let updatedMemory = context.memory;
  if (updatedMemory) {
    updatedMemory.conversationHistory.push({
      role: 'assistant',
      content
    });
  }
  
  return {
    ...context,
    messages: updatedMessages,
    memory: updatedMemory
  };
}

// Logs a tool call to the memory
export function logToolCall(
  context: MCPContext,
  toolName: string,
  args: any
): MCPContext {
  if (!context.memory) {
    context.memory = {
      conversationHistory: [...context.messages],
      toolCallHistory: []
    };
  }
  
  context.memory.toolCallHistory.push({
    toolName,
    args,
    result: null,
    timestamp: Date.now()
  });
  
  return context;
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

// Formats the MCP context for Claude API - Updated for Claude 3.5
export function formatForClaude(context: MCPContext): any {
  // Claude 3.5 API format for tools
  console.log("Formatting for Claude with messages:", context.messages.length);
  
  const formattedRequest: any = {
    model: "claude-3-5-haiku-20241022", 
    messages: context.messages,
  };
  
  // Add tools if specified - format correctly for Claude API
  if (context.tools && context.tools.length > 0) {
    console.log("Adding tools to Claude request:", context.tools.length);
    
    // Claude expects tools in this format
    formattedRequest.tools = context.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
    
    console.log("Formatted tools:", JSON.stringify(formattedRequest.tools, null, 2));
  }
  
  return formattedRequest;
}

// Extracts tool calls from OpenAI response
export function extractToolCallsFromOpenAI(response: any): any[] {
  console.log("Extracting tool calls from OpenAI response");
  
  if (!response.choices || !response.choices[0] || !response.choices[0].message) {
    console.log("No valid choices in OpenAI response");
    return [];
  }
  
  const message = response.choices[0].message;
  if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
    console.log("No tool_calls in OpenAI message");
    return [];
  }
  
  console.log(`Found ${message.tool_calls.length} tool calls in OpenAI response`);
  
  return message.tool_calls.map(toolCall => {
    console.log(`Tool call: ${toolCall.function.name}`);
    
    try {
      const args = JSON.parse(toolCall.function.arguments);
      return {
        name: toolCall.function.name,
        arguments: args
      };
    } catch (error) {
      console.error("Error parsing tool call arguments:", error);
      return {
        name: toolCall.function.name,
        arguments: {}
      };
    }
  });
}

// Extracts tool calls from Claude response - Updated for Claude 3.5
export function extractToolCallsFromClaude(response: any): any[] {
  console.log("Extracting tool calls from Claude response");
  console.log("Response structure:", Object.keys(response));
  
  if (!response.content || !Array.isArray(response.content)) {
    console.log("No content array in Claude response");
    return [];
  }
  
  // Claude 3.5's tool_use blocks
  const toolCalls = response.content
    .filter(item => item.type === 'tool_use')
    .map(item => {
      console.log(`Found tool use: ${item.name}`);
      return {
        name: item.name,
        arguments: item.input || {} // Tool inputs are in the input field
      };
    });
  
  console.log(`Extracted ${toolCalls.length} tool calls from Claude response`);
  return toolCalls;
}
