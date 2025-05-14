
/**
 * Central registry of all available tools
 * This provides a single place to define and configure all tools
 */

// Import tool definitions
import { createActionRecord } from './create-action-record/index.ts';
import { identifyProject } from './identify-project/index.ts';
import { readCrmData } from './read-crm-data/index.ts';
import { knowledgeBaseLookup } from './knowledge-base-lookup/index.ts';

// Get all tool definitions
export function getToolDefinitions() {
  const allTools = [
    {
      type: "function",
      function: {
        name: "identify_project",
        description: "Identifies projects based on search criteria like address, name, or CRM ID. Results are restricted to the user's company.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search term (address, project name, or CRM ID)"
            },
            strategy: {
              type: "string",
              enum: ["fuzzy", "exact"],
              description: "Search strategy: fuzzy for semantic search, exact for direct matching",
              default: "fuzzy"
            },
            exact_match: {
              type: "boolean",
              description: "If true, only return exact matches",
              default: false
            },
            return_all: {
              type: "boolean",
              description: "If true, return all matches rather than best match",
              default: false
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_action_record",
        description: "Creates an action record for follow-up, communication, or data updates. Actions are company-specific.",
        parameters: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "Project ID the action is associated with"
            },
            action_type: {
              type: "string",
              enum: ["message", "data_update", "set_future_reminder", "request_for_data_update", "NO_ACTION"],
              description: "Type of action to create"
            },
            message: {
              type: "string",
              description: "Description of the action or message content"
            },
            recipient_id: {
              type: "string",
              description: "Contact ID of the recipient (for message actions)"
            },
            sender_id: {
              type: "string",
              description: "Contact ID of the sender (for message actions)"
            },
            data_update_payload: {
              type: "object",
              description: "Data update information (for data_update actions)"
            },
            check_date: {
              type: "string",
              description: "ISO date string for when to check again (for reminder actions)"
            }
          },
          required: ["project_id", "action_type"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_crm_data",
        description: "Fetches CRM data for a project. Only returns data from the user's company.",
        parameters: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "Project ID to fetch CRM data for"
            },
            entity_type: {
              type: "string",
              enum: ["project", "notes", "tasks", "contacts", "all"],
              description: "Type of CRM entities to fetch",
              default: "all"
            }
          },
          required: ["project_id"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "knowledge_base_lookup",
        description: "Searches the company's knowledge base for relevant information. Results are company-specific.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for knowledge base lookup"
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return",
              default: 5
            }
          },
          required: ["query"]
        }
      }
    }
  ];
  
  return allTools;
}

// Filter tools by name
export function filterTools(toolNames: string[]) {
  const allTools = getToolDefinitions();
  return allTools.filter(tool => 
    toolNames.includes(tool.function.name)
  );
}
