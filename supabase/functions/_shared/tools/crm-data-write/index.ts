/**
 * CRM Data Write Tool
 * 
 * Writes data to the CRM system for projects, tasks, or contacts.
 * Supports multiple CRM providers including Zoho and JobProgress.
 * Shared between agent-chat and test-workflow-prompt
 */

import { Tool, ToolContext, ToolResult } from '../types.ts';

export const crmDataWriteTool: Tool = {
  name: "crm_data_write",
  description: `Writes data to the CRM system for projects, tasks, or contacts. Supports multiple CRM providers including Zoho and JobProgress. Use this to create or update records in the CRM.

For updating project fields (milestone dates, status, etc), use:
- resource_type: "project"
- operation_type: "update"  
- resource_id: (the CRM ID of the project)
- data: { field_name: value }

Example for updating milestone dates:
{
  "project_id": "uuid-from-identify-project",
  "resource_type": "project",
  "operation_type": "update",
  "resource_id": "crm-id-123",
  "data": { "completion_date": "2024-01-15", "install_date": "2024-01-10" },
  "requires_approval": true
}

NOTE: For appending notes to the project's notes field, use the append_crm_note tool instead.`,
  schema: {
    type: "object",
    properties: {
      project_id: {
        type: "string",
        description: "The UUID of the project related to this write operation. Must be obtained from identify_project."
      },
      resource_type: {
        type: "string",
        enum: ["project", "task", "note", "contact"],
        description: "The type of resource to write"
      },
      operation_type: {
        type: "string",
        enum: ["create", "update", "delete"],
        description: "The operation to perform (create new, update existing, or delete)"
      },
      resource_id: {
        type: "string",
        description: "For updates/deletes: The ID of the existing resource in the CRM"
      },
      data: {
        type: "object",
        description: "The data to write to the CRM, with keys matching the fields in our canonical model"
      },
      requires_approval: {
        type: "boolean",
        description: "Whether this write operation requires human approval before execution. Defaults to true."
      }
    },
    required: ["project_id", "resource_type", "operation_type", "data"]
  },
  
  async execute(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const {
        project_id,
        resource_type,
        operation_type,
        resource_id,
        data,
        requires_approval = true
      } = args;

      // Validate required fields
      if (!project_id) {
        return {
          status: "error",
          error: "project_id is required. Use identify_project first to get the correct UUID."
        };
      }

      if (!resource_type || !['project', 'task', 'note', 'contact'].includes(resource_type)) {
        return {
          status: "error",
          error: "resource_type must be one of: project, task, note, contact"
        };
      }

      if (!operation_type || !['create', 'update', 'delete'].includes(operation_type)) {
        return {
          status: "error",
          error: "operation_type must be one of: create, update, delete"
        };
      }

      if (!data || typeof data !== 'object') {
        return {
          status: "error",
          error: "data object is required"
        };
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(project_id)) {
        return {
          status: "error",
          error: `Invalid project_id format: ${project_id}. Must be a UUID from identify_project.`
        };
      }
      
      // If updating or deleting, ensure resource_id is provided
      if ((operation_type === "update" || operation_type === "delete") && !resource_id) {
        return {
          status: "error",
          error: `resource_id is required for ${operation_type} operations`
        };
      }
      
      console.log(`Executing crm_data_write: ${operation_type} ${resource_type} for project ${project_id}`);
      
      // Get the project's company
      const { data: project, error: projectError } = await context.supabase
        .from('projects')
        .select('company_id, project_name, crm_id')
        .eq('id', project_id)
        .single();
        
      if (projectError || !project) {
        console.error("Error fetching project:", projectError);
        return {
          status: "error",
          error: `Failed to find project: ${projectError?.message || "Not found"}`
        };
      }
      
      // If requires approval, create an action record
      if (requires_approval) {
        const { data: actionRecord, error: actionError } = await context.supabase
          .from('action_records')
          .insert({
            action_type: "crm_write",
            project_id: project_id,
            requires_approval: true,
            status: "pending",
            action_payload: {
              resource_type: resource_type,
              operation_type: operation_type,
              resource_id: resource_id,
              data: data,
              company_id: project.company_id,
              description: `${operation_type} ${resource_type} in CRM`
            },
            message: `${operation_type.charAt(0).toUpperCase() + operation_type.slice(1)} ${resource_type} in CRM for ${project.project_name || 'project'}: ${JSON.stringify(data).substring(0, 100)}`
          })
          .select('id')
          .single();
        
        if (actionError) {
          console.error("Error creating action record:", actionError);
          return {
            status: "error",
            error: `Failed to create action record: ${actionError.message}`
          };
        }
        
        console.log(`Created action record ${actionRecord.id} for CRM write`);
        
        return {
          status: "success",
          action_record_id: actionRecord.id,
          requires_approval: true,
          message: `Created action record for CRM write operation (${operation_type} ${resource_type}). Waiting for approval.`
        };
      }
      
      // If no approval needed, create job directly
      const { data: job, error: jobError } = await context.supabase
        .from('integration_job_queue')
        .insert({
          company_id: project.company_id,
          project_id: project_id,
          operation_type: operation_type === "create" ? "write" : 
                          operation_type === "update" ? "write" : "delete",
          resource_type: resource_type,
          payload: {
            resourceType: resource_type,
            resourceId: resource_id,
            data: data,
            operationType: operation_type
          },
          status: 'pending'
        })
        .select('id')
        .single();
        
      if (jobError) {
        console.error("Error creating integration job:", jobError);
        return {
          status: "error",
          error: `Failed to create integration job: ${jobError.message}`
        };
      }
      
      console.log(`Created integration job ${job.id} for immediate CRM write`);
      
      return {
        status: "success",
        job_id: job.id,
        requires_approval: false,
        message: `Created integration job for immediate CRM write operation (${operation_type} ${resource_type}).`
      };
    } catch (error) {
      console.error("Error executing crm_data_write tool:", error);
      return {
        status: "error",
        error: error instanceof Error ? error.message : "An unexpected error occurred"
      };
    }
  }
};
