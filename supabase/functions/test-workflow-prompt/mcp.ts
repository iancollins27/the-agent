
// MCP related functions

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
 * Improved to properly handle assistant message and tool response sequences
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
 * Get the default tools for MCP
 */
export function getDefaultTools() {
  return [
    {
      type: "function",
      function: {
        name: "detect_action",
        description: "Detects if any action is needed based on the project state. Always call this tool first to determine the course of action.",
        parameters: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              enum: ["NO_ACTION", "ACTION_NEEDED", "SET_FUTURE_REMINDER", "REQUEST_HUMAN_REVIEW"],
              description: "The decision on what action is needed"
            },
            reason: {
              type: "string",
              description: "Reason for the decision"
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Priority of the action"
            },
            days_until_check: {
              type: "integer",
              description: "If SET_FUTURE_REMINDER is selected, how many days until the check should occur"
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
        description: "Creates an action record based on the detect_action result. Use when decision is ACTION_NEEDED.",
        parameters: {
          type: "object",
          properties: {
            action_type: {
              type: "string",
              enum: ["message", "data_update", "set_future_reminder", "human_in_loop", "knowledge_query"],
              description: "The type of action to create"
            },
            description: {
              type: "string",
              description: "Description of the action"
            },
            recipient: {
              type: "string",
              description: "Who should receive this action"
            },
            sender: {
              type: "string",
              description: "Who is sending this action"
            },
            message_text: {
              type: "string", 
              description: "For 'message' action type, the text of the message"
            },
            days_until_check: {
              type: "integer",
              description: "For 'set_future_reminder' action type, days until the check"
            },
            check_reason: {
              type: "string", 
              description: "For 'set_future_reminder' action type, reason for the check"
            },
            field: {
              type: "string",
              description: "For 'data_update' action type, the field to update"
            },
            value: {
              type: "string", 
              description: "For 'data_update' action type, the value to set"
            },
            decision: {
              type: "string",
              enum: ["NO_ACTION", "ACTION_NEEDED", "SET_FUTURE_REMINDER", "REQUEST_HUMAN_REVIEW"],
              description: "The decision that led to this action being created"
            }
          },
          required: ["action_type", "description"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "generate_action",
        description: "Creates a specific action for team members to execute based on the project's needs. Only use after detect_action confirms ACTION_NEEDED.",
        parameters: {
          type: "object",
          properties: {
            action_type: {
              type: "string",
              enum: ["message", "data_update", "set_future_reminder", "human_in_loop", "knowledge_query"],
              description: "The type of action to be taken"
            },
            description: {
              type: "string",
              description: "Detailed description of what needs to be done"
            },
            recipient_role: {
              type: "string",
              description: "Who should receive this action"
            },
            message_text: {
              type: "string",
              description: "For message actions, the content of the message"
            },
            sender: {
              type: "string",
              description: "For message actions, who is sending the message"
            }
          },
          required: ["action_type", "description", "recipient_role"]
        }
      }
    }
  ];
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
