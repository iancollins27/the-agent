/**
 * Append CRM Note Tool
 * 
 * Appends a note to the existing notes field on a CRM project record.
 * Instead of creating a new note record, this updates the project's notes field
 * by reading the current value and appending the new content with a timestamp.
 */

import { Tool, ToolContext, ToolResult } from '../types.ts';

export const appendCrmNoteTool: Tool = {
  name: "append_crm_note",
  description: `Appends a note to the existing notes field on a CRM project record. The note is added with a timestamp and author info, and does NOT overwrite existing notes - it appends to them. Use this tool when:
- A customer provides an update about their project
- There's a problem or issue reported
- Important information is shared during conversation
- Milestone updates or status changes occur
- Any interaction that should be documented in the project record`,
  schema: {
    type: "object",
    properties: {
      project_id: {
        type: "string",
        description: "UUID of the project to append the note to. Must be obtained from identify_project tool."
      },
      note_content: {
        type: "string",
        description: "The note text to append to the project's notes field"
      },
      note_type: {
        type: "string",
        enum: ["general", "customer_update", "issue", "milestone", "status_change", "communication"],
        description: "Category of the note for context. Defaults to 'general'"
      },
      author: {
        type: "string",
        description: "Who is leaving the note (e.g., 'AI Agent', contact name). Defaults to 'AI Agent'"
      },
      requires_approval: {
        type: "boolean",
        description: "Whether to require human approval before writing. Defaults to true for safety."
      }
    },
    required: ["project_id", "note_content"]
  },
  
  async execute(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const { 
        project_id, 
        note_content, 
        note_type = "general",
        author = "AI Agent",
        requires_approval = true 
      } = args;
      
      if (!project_id) {
        return {
          status: "error",
          error: "project_id is required. Use identify_project first to get the correct UUID."
        };
      }
      
      if (!note_content || note_content.trim() === "") {
        return {
          status: "error",
          error: "note_content is required and cannot be empty"
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
      
      console.log(`Executing append_crm_note: project=${project_id}, type=${note_type}`);
      
      // Get project details including crm_id and company_id
      const { data: project, error: projectError } = await context.supabase
        .from('projects')
        .select('id, crm_id, company_id, project_name')
        .eq('id', project_id)
        .single();
        
      if (projectError || !project) {
        console.error("Error fetching project:", projectError);
        return {
          status: "error",
          error: `Failed to find project: ${projectError?.message || "Not found"}`
        };
      }
      
      if (!project.crm_id) {
        return {
          status: "error",
          error: "Project does not have a CRM ID linked. Cannot append note to CRM."
        };
      }
      
      // Format the note with timestamp and metadata
      const timestamp = new Date().toISOString();
      const formattedDate = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
      
      const formattedNote = `[${formattedDate}] [${note_type.toUpperCase()}] ${author}: ${note_content}`;
      
      // Create the payload for the append operation
      const appendPayload = {
        resource_type: "project",
        operation_type: "append_note",
        resource_id: project.crm_id,
        data: {
          note_content: formattedNote,
          raw_content: note_content,
          note_type: note_type,
          author: author,
          timestamp: timestamp
        },
        company_id: project.company_id,
        project_name: project.project_name
      };
      
      if (requires_approval) {
        // Create an action record for approval
        const { data: actionRecord, error: actionError } = await context.supabase
          .from('action_records')
          .insert({
            action_type: "crm_append_note",
            project_id: project_id,
            requires_approval: true,
            status: "pending",
            action_payload: appendPayload,
            message: `Append note to ${project.project_name || 'project'}: "${note_content.substring(0, 100)}${note_content.length > 100 ? '...' : ''}"`
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
        
        console.log(`Created action record ${actionRecord.id} for CRM note append`);
        
        return {
          status: "success",
          action_record_id: actionRecord.id,
          requires_approval: true,
          message: `Note queued for approval. Will append to ${project.project_name || 'project'} CRM record once approved.`,
          note_preview: formattedNote
        };
      }
      
      // If no approval needed, create integration job directly
      const { data: job, error: jobError } = await context.supabase
        .from('integration_job_queue')
        .insert({
          company_id: project.company_id,
          project_id: project_id,
          operation_type: "append_note",
          resource_type: "project",
          payload: appendPayload,
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
      
      console.log(`Created integration job ${job.id} for immediate CRM note append`);
      
      return {
        status: "success",
        job_id: job.id,
        requires_approval: false,
        message: `Note will be appended to ${project.project_name || 'project'} CRM record.`,
        note_preview: formattedNote
      };
    } catch (error) {
      console.error("Error executing append_crm_note tool:", error);
      return {
        status: "error",
        error: error instanceof Error ? error.message : "An unexpected error occurred"
      };
    }
  }
};
