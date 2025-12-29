/**
 * Central registry of all tool definitions
 * Each tool has its schema, description, and edge function name
 */

export interface ToolDefinition {
  name: string;
  description: string;
  schema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
  edge_function: string;
}

/**
 * All available tools in the system
 * Orchestrators filter this list based on their enabled tools
 */
export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  create_action_record: {
    name: 'create_action_record',
    description: 'Creates an action record based on your analysis. Use this when you determine an action is needed (message, data update, or set a reminder).',
    schema: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          enum: ['send_message', 'set_future_reminder', 'data_update', 'escalation', 'human_in_loop', 'no_action'],
          description: 'The type of action to create'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Priority level of the action'
        },
        days_until_check: {
          type: 'number',
          description: 'For reminders: how many days until the check should occur'
        },
        check_reason: {
          type: 'string',
          description: 'For reminders: why this check is needed'
        },
        recipient: {
          type: 'string',
          description: 'For messages: the name or role of the recipient'
        },
        recipient_id: {
          type: 'string',
          description: 'For messages: the UUID of the recipient contact'
        },
        message_text: {
          type: 'string',
          description: 'For messages: the message content to send'
        },
        description: {
          type: 'string',
          description: 'Description of the action'
        },
        reason: {
          type: 'string',
          description: 'Reason for the action'
        },
        data_field: {
          type: 'string',
          description: 'For data updates: the field to update'
        },
        data_value: {
          type: 'string',
          description: 'For data updates: the new value'
        },
        escalation_details: {
          type: 'string',
          description: 'For escalations: details about the escalation'
        }
      },
      required: ['action_type']
    },
    edge_function: 'tool-create-action-record'
  },

  identify_project: {
    name: 'identify_project',
    description: 'Identifies a project based on a search query. Use this to find projects by name, address, CRM ID, or other identifiers.',
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to identify the project (address, project name, CRM ID, etc.)'
        },
        type: {
          type: 'string',
          enum: ['any', 'id', 'crm_id', 'name', 'address'],
          description: "Type of search to perform. 'any' searches all fields, others are specific"
        }
      },
      required: ['query']
    },
    edge_function: 'tool-identify-project'
  },

  session_manager: {
    name: 'session_manager',
    description: 'Manage chat sessions across channels (web, SMS, email), store and retrieve conversation history',
    schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'update', 'create', 'find'],
          description: 'The action to perform on the session'
        },
        session_id: {
          type: 'string',
          description: 'The ID of the session to get or update'
        },
        company_id: {
          type: 'string',
          description: 'The company ID for the session'
        },
        project_id: {
          type: 'string',
          description: 'The project ID associated with the session'
        },
        channel_type: {
          type: 'string',
          enum: ['web', 'sms', 'email'],
          description: 'The type of channel for this session'
        },
        channel_identifier: {
          type: 'string',
          description: 'The identifier for this channel (phone number, email address)'
        },
        contact_id: {
          type: 'string',
          description: 'The contact ID associated with this session'
        },
        memory_mode: {
          type: 'string',
          enum: ['standard', 'detailed'],
          description: 'The memory mode for this session'
        },
        communication_id: {
          type: 'string',
          description: 'A communication ID to link to this session'
        }
      },
      required: ['action']
    },
    edge_function: 'tool-session-manager'
  },

  channel_response: {
    name: 'channel_response',
    description: 'Send responses to users via their preferred channel (web, SMS, email)',
    schema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The ID of the session to send the response to'
        },
        message: {
          type: 'string',
          description: 'The message content to send'
        },
        project_id: {
          type: 'string',
          description: 'Optional project ID to associate with the message'
        }
      },
      required: ['session_id', 'message']
    },
    edge_function: 'tool-channel-response'
  },

  escalation: {
    name: 'escalation',
    description: 'Creates an escalation for a project that requires immediate management attention due to issues, delays, or non-responsive contacts.',
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'The reason for escalating this project'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the escalation situation'
        },
        escalation_details: {
          type: 'string',
          description: 'Additional details about what requires escalation'
        },
        project_id: {
          type: 'string',
          description: 'The project ID that needs escalation'
        }
      },
      required: ['reason', 'project_id']
    },
    edge_function: 'tool-escalation'
  },

  crm_read: {
    name: 'crm_read',
    description: 'Reads data from the CRM system including projects, contacts, and activities. Supports multiple CRM providers.',
    schema: {
      type: 'object',
      properties: {
        resource_type: {
          type: 'string',
          enum: ['project', 'contact', 'activity', 'note'],
          description: 'The type of resource to read'
        },
        project_id: {
          type: 'string',
          description: 'Project ID to filter results'
        },
        crm_id: {
          type: 'string',
          description: 'CRM ID of the specific resource'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return'
        }
      },
      required: ['resource_type']
    },
    edge_function: 'tool-crm-read'
  },

  crm_write: {
    name: 'crm_write',
    description: 'Writes data to the CRM system for projects, tasks, notes, or contacts. For notes/activities, use resource_type "note" with the note content in data.content or data.message. This will create an activity record in Zoho.',
    schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project related to this write operation'
        },
        resource_type: {
          type: 'string',
          enum: ['project', 'task', 'note', 'contact'],
          description: 'The type of resource to write. Use "note" to create activities/notes in the CRM.'
        },
        operation_type: {
          type: 'string',
          enum: ['create', 'update', 'delete'],
          description: 'The operation to perform (create new, update existing, or delete)'
        },
        resource_id: {
          type: 'string',
          description: 'For updates/deletes: The ID of the existing resource in the CRM'
        },
        data: {
          type: 'object',
          description: 'The data to write. For notes, include "content" or "message" with the note text.'
        },
        requires_approval: {
          type: 'boolean',
          description: 'Whether this write operation requires human approval before execution'
        }
      },
      required: ['project_id', 'resource_type', 'operation_type', 'data']
    },
    edge_function: 'tool-crm-write'
  },

  knowledge_lookup: {
    name: 'knowledge_lookup',
    description: 'Searches the company knowledge base for relevant information to answer questions.',
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant information'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)'
        }
      },
      required: ['query']
    },
    edge_function: 'tool-knowledge-lookup'
  },

  email_summary: {
    name: 'email_summary',
    description: 'Generates or updates email summaries for a project.',
    schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'UUID of the project to summarize emails for'
        },
        days_lookback: {
          type: 'number',
          description: 'Number of days to look back for emails if no last processed date exists (default: 7)'
        },
        append_mode: {
          type: 'boolean',
          description: 'Whether to append to existing summary (true) or replace it (false). Default: true'
        }
      },
      required: ['project_id']
    },
    edge_function: 'tool-email-summary'
  }
};

/**
 * Get tool definitions formatted for OpenAI function calling
 */
export function getToolDefinitionsForLLM(enabledTools: string[]): Array<{
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}> {
  return enabledTools
    .filter(name => name in TOOL_DEFINITIONS)
    .map(name => {
      const def = TOOL_DEFINITIONS[name];
      return {
        type: 'function',
        function: {
          name: def.name,
          description: def.description,
          parameters: def.schema
        }
      };
    });
}

/**
 * Get the edge function name for a tool
 */
export function getEdgeFunctionName(toolName: string): string | null {
  const def = TOOL_DEFINITIONS[toolName];
  return def?.edge_function ?? null;
}

/**
 * Check if a tool exists in the registry
 */
export function isValidTool(toolName: string): boolean {
  return toolName in TOOL_DEFINITIONS;
}
