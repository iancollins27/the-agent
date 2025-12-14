
/**
 * Data fetch tool implementation
 * Fetches comprehensive data for a specific project including details, contacts, communications, tasks and notes.
 * Shared between agent-chat and test-workflow-prompt
 */

import { Tool, ToolResult, ToolContext } from '../types.ts';

export const dataFetchTool: Tool = {
  name: "data_fetch",
  description: "Fetches comprehensive data for a specific project including details, contacts, communications, tasks and notes. IMPORTANT: You must use the project_id (UUID) returned by the identify_project tool - do NOT use raw user input or CRM IDs. Always call identify_project first to get the correct project_id before using this tool.",
  schema: {
    type: "object",
    properties: {
      project_id: {
        type: "string",
        description: "UUID of the project to fetch data for. MUST be obtained from the identify_project tool result, not from user input directly. Use the 'project_id' field from identify_project response."
      },
      include_raw: {
        type: "boolean",
        description: "Whether to include raw provider data in the response (defaults to false)"
      }
    },
    required: ["project_id"]
  },
  
  async execute(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const { project_id, include_raw = false } = args;
      
      if (!project_id) {
        return {
          status: "error",
          error: "Project ID is required. You must call identify_project first to get the correct project_id."
        };
      }
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(project_id)) {
        return {
          status: "error",
          error: `Invalid project_id format: ${project_id}. You must use the UUID returned by identify_project tool, not a CRM ID or other identifier.`
        };
      }
      
      console.log(`Executing data_fetch tool: project=${project_id}`);
      
      // Make request to data-fetch edge function
      const response = await context.supabase.functions.invoke('data-fetch', {
        body: {
          project_id,
          include_raw
        }
      });
      
      if (response.error) {
        console.error("Data fetch error:", response.error);
        
        // Enhanced error message for UUID not found
        if (response.error.message && response.error.message.includes('No project found with ID')) {
          return {
            status: "error",
            error: `Project not found with UUID: ${project_id}. This suggests you may be using an incorrect project_id. Please call identify_project again to get the correct UUID for this project.`
          };
        }
        
        return {
          status: "error",
          error: `Failed to fetch project data: ${response.error.message || "Unknown error"}`
        };
      }
      
      return {
        status: "success",
        provider: response.data.provider,
        project: response.data.project,
        contacts: response.data.contacts,
        communications: response.data.communications,
        tasks: response.data.tasks,
        notes: response.data.notes,
        ...(response.data.raw && { raw: response.data.raw }),
        fetched_at: response.data.fetched_at
      };
    } catch (error) {
      console.error("Error executing data_fetch tool:", error);
      return {
        status: "error",
        error: error.message || "An unexpected error occurred"
      };
    }
  }
};
