
/**
 * Read CRM Data Tool
 * 
 * This tool allows the AI to read data from the CRM system based on a project CRM ID
 */

import { ToolContext } from '../types.ts';

export const readCrmData = {
  name: "read_crm_data",
  description: "Retrieves data from the CRM system for a specific project using its CRM ID",
  schema: {
    type: "object",
    properties: {
      crm_id: {
        type: "string",
        description: "The CRM identifier of the project to retrieve data for"
      },
      entity_type: {
        type: "string",
        enum: ["project", "contact", "company", "note", "task", "communication"],
        description: "Type of entity to retrieve for this project"
      },
      limit: {
        type: "integer",
        description: "Maximum number of records to retrieve (default: 10)"
      }
    },
    required: ["crm_id", "entity_type"]
  },
  
  execute: async (args: any, context: ToolContext) => {
    const { supabase } = context;
    
    try {
      const { crm_id, entity_type, limit = 10 } = args;
      
      console.log(`Reading CRM data for entity type ${entity_type} with project CRM ID: ${crm_id}`);
      
      // First, find the project by CRM ID
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, company_id")
        .eq("crm_id", crm_id)
        .single();
      
      if (projectError || !project) {
        return {
          status: "error",
          error: `Project with CRM ID ${crm_id} not found`,
          message: `Could not find a project with the provided CRM ID: ${crm_id}`
        };
      }
      
      const projectId = project.id;
      const companyId = project.company_id;
      
      console.log(`Found project with ID: ${projectId}, company ID: ${companyId}`);
      
      if (!companyId) {
        return {
          status: "error",
          error: "Company ID not found for this project",
          message: "The project exists but has no associated company"
        };
      }
      
      let response;
      
      switch (entity_type) {
        case "project":
          response = await fetchProjects(supabase, companyId, projectId, limit);
          break;
        case "contact":
          response = await fetchContacts(supabase, projectId, limit);
          break;
        case "company":
          response = await fetchCompanies(supabase, companyId, limit);
          break;
        case "note":
          response = await fetchNotes(supabase, projectId, limit);
          break;
        case "task":
          response = await fetchTasks(supabase, projectId, limit);
          break;
        case "communication":
          response = await fetchCommunications(supabase, projectId, limit);
          break;
        default:
          return {
            status: "error",
            error: `Unknown entity type: ${entity_type}`,
            message: `The entity type '${entity_type}' is not supported. Please use one of: project, contact, company, note, task, communication`
          };
      }
      
      return {
        status: "success",
        entity_type,
        project_id: projectId,
        company_id: companyId,
        data: response.data || [],
        count: response.data ? response.data.length : 0,
        message: `Successfully retrieved ${response.data ? response.data.length : 0} ${entity_type} records for project with CRM ID ${crm_id}`
      };
    } catch (error) {
      console.error("Error in read_crm_data tool:", error);
      return {
        status: "error",
        error: error.message || "Unknown error occurred while reading CRM data",
        message: "Failed to read data from CRM system"
      };
    }
  }
};

// Helper functions to fetch different types of entities
async function fetchProjects(supabase: any, companyId: string, projectId: string, limit: number = 10) {
  return await supabase
    .from("projects")
    .select("id, project_name, Address, crm_id, Project_status, summary, next_step")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .limit(limit);
}

async function fetchContacts(supabase: any, projectId: string, limit: number = 10) {
  return await supabase
    .from("contacts")
    .select("id, full_name, email, phone_number, role, contact_type")
    .eq("id", supabase.rpc("get_project_contacts", { p_project_id: projectId }))
    .limit(limit);
}

async function fetchCompanies(supabase: any, companyId: string, limit: number = 10) {
  return await supabase
    .from("companies")
    .select("id, name, plan_type, plan_started_at, default_project_track")
    .eq("id", companyId)
    .limit(limit);
}

async function fetchNotes(supabase: any, projectId: string, limit: number = 10) {
  return await supabase
    .from("project_notes")
    .select("id, project_id, title, content, created_by, created_at")
    .eq("project_id", projectId)
    .limit(limit);
}

async function fetchTasks(supabase: any, projectId: string, limit: number = 10) {
  return await supabase
    .from("project_tasks")
    .select("id, project_id, title, description, status, assigned_to, due_date, created_at")
    .eq("project_id", projectId)
    .limit(limit);
}

async function fetchCommunications(supabase: any, projectId: string, limit: number = 10) {
  return await supabase
    .from("communications")
    .select("id, project_id, type, direction, content, sender, recipient, timestamp, metadata")
    .eq("project_id", projectId)
    .limit(limit);
}
