
import { Tool } from '../types.ts';
import { createActionRecord } from '../../database/index.ts';
import { z } from 'https://esm.sh/zod@3.21.4';

export const crmDataWrite: Tool = {
  name: "crm_data_write",
  description: "Writes data to the CRM system for projects, tasks, or contacts. Supports multiple CRM providers including Zoho and JobProgress. Use this to create or update records in the CRM.",
  schema: {
    type: "object",
    properties: {
      project_id: {
        type: "string",
        description: "The ID of the project related to this write operation"
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
        description: "Whether this write operation requires human approval before execution"
      }
    },
    required: ["project_id", "resource_type", "operation_type", "data"]
  },
  
  async execute(args: any, context: any): Promise<any> {
    try {
      // Validate input
      const schema = z.object({
        project_id: z.string().uuid(),
        resource_type: z.enum(["project", "task", "note", "contact"]),
        operation_type: z.enum(["create", "update", "delete"]),
        resource_id: z.string().optional(),
        data: z.record(z.any()),
        requires_approval: z.boolean().default(true)
      });
      
      const validatedArgs = schema.parse(args);
      
      // If updating or deleting, ensure resource_id is provided
      if ((validatedArgs.operation_type === "update" || validatedArgs.operation_type === "delete") 
          && !validatedArgs.resource_id) {
        return {
          status: "error",
          error: `resource_id is required for ${validatedArgs.operation_type} operations`
        };
      }
      
      // Get the project's company
      const { data: project, error: projectError } = await context.supabase
        .from('projects')
        .select('company_id')
        .eq('id', validatedArgs.project_id)
        .single();
        
      if (projectError || !project) {
        console.error("Error fetching project:", projectError);
        return {
          status: "error",
          error: `Failed to find project: ${projectError?.message || "Not found"}`
        };
      }
      
      // If requires approval, create an action record
      if (validatedArgs.requires_approval) {
        // Create an action record for this operation
        const actionRecordId = await createActionRecord({
          action_type: "crm_write",
          project_id: validatedArgs.project_id,
          requires_approval: true,
          action_payload: {
            resource_type: validatedArgs.resource_type,
            operation_type: validatedArgs.operation_type,
            resource_id: validatedArgs.resource_id,
            data: validatedArgs.data,
            company_id: project.company_id,
            description: `Write ${validatedArgs.resource_type} data to CRM (${validatedArgs.operation_type})`
          },
          message: `Update ${validatedArgs.resource_type} in CRM with: ${JSON.stringify(validatedArgs.data)}`
        });
        
        return {
          status: "success",
          action_record_id: actionRecordId,
          requires_approval: true,
          message: `Created action record for CRM write operation (${validatedArgs.operation_type} ${validatedArgs.resource_type}). Waiting for approval.`
        };
      }
      
      // If no approval needed, create job directly
      const { data: job, error: jobError } = await context.supabase
        .from('integration_job_queue')
        .insert({
          company_id: project.company_id,
          project_id: validatedArgs.project_id,
          operation_type: validatedArgs.operation_type === "create" ? "write" : 
                          validatedArgs.operation_type === "update" ? "write" : "delete",
          resource_type: validatedArgs.resource_type,
          payload: {
            resourceType: validatedArgs.resource_type,
            resourceId: validatedArgs.resource_id,
            data: validatedArgs.data,
            operationType: validatedArgs.operation_type
          },
          status: 'pending'
        })
        .select()
        .single();
        
      if (jobError) {
        console.error("Error creating integration job:", jobError);
        return {
          status: "error",
          error: `Failed to create integration job: ${jobError.message}`
        };
      }
      
      return {
        status: "success",
        job_id: job.id,
        requires_approval: false,
        message: `Created integration job for immediate CRM write operation (${validatedArgs.operation_type} ${validatedArgs.resource_type}).`
      };
    } catch (error) {
      console.error("Error executing crm_data_write tool:", error);
      return {
        status: "error",
        error: error.message || "An unexpected error occurred"
      };
    }
  }
};
