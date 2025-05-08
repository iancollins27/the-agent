
import { Tool, ToolResult } from '../types.ts';

export const dataFetch: Tool = {
  name: "data_fetch",
  description: "Fetches comprehensive data for a specific project including details, contacts, communications, tasks and notes. Use this to get a complete view of a project's current state.",
  schema: {
    type: "object",
    properties: {
      project_id: {
        type: "string",
        description: "UUID of the project to fetch data for"
      },
      include_raw: {
        type: "boolean",
        description: "Whether to include raw provider data in the response (defaults to false)"
      }
    },
    required: ["project_id"]
  },
  
  async execute(args: any, context: any): Promise<ToolResult> {
    try {
      const { project_id, include_raw = false } = args;
      
      if (!project_id) {
        return {
          status: "error",
          error: "Project ID is required"
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
