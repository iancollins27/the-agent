
import { Tool, ToolResult } from '../types.ts';

export const dataFetch: Tool = {
  name: "data_fetch",
  description: "Fetches data from CRM systems for a specific company and resource type. Use this to get information about projects, tasks, notes, emails, or SMS.",
  schema: {
    type: "object",
    properties: {
      company_id: {
        type: "string",
        description: "UUID of the company to fetch data for"
      },
      resource: {
        type: "string",
        enum: ["project", "task", "note", "email", "sms"],
        description: "Type of resource to fetch (project, task, note, email, sms)"
      },
      resource_id: {
        type: "string",
        description: "Optional ID of specific resource to fetch. If omitted, returns all resources of the specified type."
      },
      include_raw: {
        type: "boolean",
        description: "Whether to include raw provider data in the response (defaults to false)"
      }
    },
    required: ["company_id", "resource"]
  },
  
  async execute(args: any, context: any): Promise<ToolResult> {
    try {
      const { company_id, resource, resource_id, include_raw = false } = args;
      
      console.log(`Executing data_fetch tool: company=${company_id}, resource=${resource}, id=${resource_id || "all"}`);
      
      // Make request to data-fetch edge function
      const response = await context.supabase.functions.invoke('data-fetch', {
        body: {
          company_id,
          resource,
          resource_id,
          include_raw
        }
      });
      
      if (response.error) {
        return {
          status: "error",
          error: `Failed to fetch data: ${response.error.message || "Unknown error"}`
        };
      }
      
      return {
        status: "success",
        provider: response.data.provider,
        resource: response.data.resource,
        data: response.data.data,
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
