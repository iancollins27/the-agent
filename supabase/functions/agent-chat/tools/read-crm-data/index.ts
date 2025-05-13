
/**
 * Read CRM Data Tool
 * 
 * This tool allows the AI to read data from the CRM system based on specific criteria
 */

import { ToolContext } from '../types.ts';

export const readCrmData = {
  name: "read_crm_data",
  description: "Retrieves data from the CRM system based on specific parameters like entity type, ID, or search criteria",
  schema: {
    type: "object",
    properties: {
      entity_type: {
        type: "string",
        enum: ["project", "contact", "company", "note", "task", "communication"],
        description: "The type of entity to retrieve from CRM"
      },
      entity_id: {
        type: "string",
        description: "ID of the specific entity to retrieve (optional, provide either this or search_criteria)"
      },
      search_criteria: {
        type: "object",
        description: "Search criteria to filter entities (optional, provide either this or entity_id)",
        properties: {
          name: {
            type: "string",
            description: "Name to search for"
          },
          status: {
            type: "string",
            description: "Status to filter by"
          },
          date_range: {
            type: "object",
            properties: {
              from: {
                type: "string",
                description: "Start date in ISO format (YYYY-MM-DD)"
              },
              to: {
                type: "string",
                description: "End date in ISO format (YYYY-MM-DD)"
              }
            }
          }
        }
      },
      limit: {
        type: "integer",
        description: "Maximum number of records to retrieve"
      }
    },
    required: ["entity_type"]
  },
  
  execute: async (args: any, context: ToolContext) => {
    const { supabase, companyId } = context;
    
    try {
      const { entity_type, entity_id, search_criteria, limit = 10 } = args;
      
      console.log(`Reading CRM data for entity type ${entity_type}, company ID: ${companyId || 'not specified'}`);
      
      // If no company ID is provided, we can't continue
      if (!companyId) {
        return {
          status: "error",
          error: "Company ID is required to read CRM data",
          message: "Please identify a project first to establish company context"
        };
      }
      
      let response;
      
      switch (entity_type) {
        case "project":
          response = await fetchProjects(supabase, companyId, entity_id, search_criteria, limit);
          break;
        case "contact":
          response = await fetchContacts(supabase, companyId, entity_id, search_criteria, limit);
          break;
        case "company":
          response = await fetchCompanies(supabase, companyId, entity_id, search_criteria, limit);
          break;
        case "note":
          response = await fetchNotes(supabase, companyId, entity_id, search_criteria, limit);
          break;
        case "task":
          response = await fetchTasks(supabase, companyId, entity_id, search_criteria, limit);
          break;
        case "communication":
          response = await fetchCommunications(supabase, companyId, entity_id, search_criteria, limit);
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
        data: response.data || [],
        count: response.data ? response.data.length : 0,
        message: `Successfully retrieved ${response.data ? response.data.length : 0} ${entity_type} records`
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
async function fetchProjects(supabase: any, companyId: string, projectId?: string, searchCriteria?: any, limit: number = 10) {
  let query = supabase
    .from("projects")
    .select("id, project_name, Address, crm_id, Project_status, summary, next_step")
    .eq("company_id", companyId);
  
  if (projectId) {
    query = query.eq("id", projectId);
  } else if (searchCriteria) {
    if (searchCriteria.name) {
      query = query.ilike("project_name", `%${searchCriteria.name}%`);
    }
    
    if (searchCriteria.status) {
      query = query.eq("Project_status", searchCriteria.status);
    }
    
    // Handle date range if provided
    if (searchCriteria.date_range) {
      if (searchCriteria.date_range.from) {
        query = query.gte("created_at", searchCriteria.date_range.from);
      }
      if (searchCriteria.date_range.to) {
        query = query.lte("created_at", searchCriteria.date_range.to);
      }
    }
  }
  
  return await query.limit(limit);
}

async function fetchContacts(supabase: any, companyId: string, contactId?: string, searchCriteria?: any, limit: number = 10) {
  let query = supabase
    .from("contacts")
    .select("id, full_name, email, phone_number, role, contact_type")
    .eq("company_id", companyId);
  
  if (contactId) {
    query = query.eq("id", contactId);
  } else if (searchCriteria) {
    if (searchCriteria.name) {
      query = query.ilike("full_name", `%${searchCriteria.name}%`);
    }
    
    if (searchCriteria.role) {
      query = query.eq("role", searchCriteria.role);
    }
  }
  
  return await query.limit(limit);
}

async function fetchCompanies(supabase: any, companyId: string, specificCompanyId?: string, searchCriteria?: any, limit: number = 10) {
  let query = supabase
    .from("companies")
    .select("id, name, plan_type, plan_started_at, default_project_track")
  
  // If requesting a specific company, use that ID; otherwise use the context company ID
  if (specificCompanyId) {
    query = query.eq("id", specificCompanyId);
  } else {
    query = query.eq("id", companyId);
  }
  
  if (searchCriteria && searchCriteria.name && !specificCompanyId) {
    // Only apply name filter if not looking for a specific company ID
    query = query.ilike("name", `%${searchCriteria.name}%`);
  }
  
  return await query.limit(limit);
}

async function fetchNotes(supabase: any, companyId: string, noteId?: string, searchCriteria?: any, limit: number = 10) {
  let query = supabase
    .from("project_notes")
    .select("id, project_id, title, content, created_by, created_at, projects!inner(company_id)")
    .eq("projects.company_id", companyId);
  
  if (noteId) {
    query = query.eq("id", noteId);
  } else if (searchCriteria) {
    if (searchCriteria.project_id) {
      query = query.eq("project_id", searchCriteria.project_id);
    }
    
    if (searchCriteria.title) {
      query = query.ilike("title", `%${searchCriteria.title}%`);
    }
    
    // Handle date range if provided
    if (searchCriteria.date_range) {
      if (searchCriteria.date_range.from) {
        query = query.gte("created_at", searchCriteria.date_range.from);
      }
      if (searchCriteria.date_range.to) {
        query = query.lte("created_at", searchCriteria.date_range.to);
      }
    }
  }
  
  const result = await query.limit(limit);
  
  // Remove the nested projects data for cleaner response
  const cleanedData = result.data?.map(note => {
    const { projects, ...noteData } = note;
    return noteData;
  });
  
  return { ...result, data: cleanedData };
}

async function fetchTasks(supabase: any, companyId: string, taskId?: string, searchCriteria?: any, limit: number = 10) {
  let query = supabase
    .from("project_tasks")
    .select("id, project_id, title, description, status, assigned_to, due_date, created_at, projects!inner(company_id)")
    .eq("projects.company_id", companyId);
  
  if (taskId) {
    query = query.eq("id", taskId);
  } else if (searchCriteria) {
    if (searchCriteria.project_id) {
      query = query.eq("project_id", searchCriteria.project_id);
    }
    
    if (searchCriteria.status) {
      query = query.eq("status", searchCriteria.status);
    }
    
    if (searchCriteria.assigned_to) {
      query = query.eq("assigned_to", searchCriteria.assigned_to);
    }
    
    // Handle date range for due_date if provided
    if (searchCriteria.date_range) {
      if (searchCriteria.date_range.from) {
        query = query.gte("due_date", searchCriteria.date_range.from);
      }
      if (searchCriteria.date_range.to) {
        query = query.lte("due_date", searchCriteria.date_range.to);
      }
    }
  }
  
  const result = await query.limit(limit);
  
  // Remove the nested projects data for cleaner response
  const cleanedData = result.data?.map(task => {
    const { projects, ...taskData } = task;
    return taskData;
  });
  
  return { ...result, data: cleanedData };
}

async function fetchCommunications(supabase: any, companyId: string, communicationId?: string, searchCriteria?: any, limit: number = 10) {
  let query = supabase
    .from("communications")
    .select("id, project_id, type, direction, content, sender, recipient, timestamp, metadata, projects!inner(company_id)")
    .eq("projects.company_id", companyId);
  
  if (communicationId) {
    query = query.eq("id", communicationId);
  } else if (searchCriteria) {
    if (searchCriteria.project_id) {
      query = query.eq("project_id", searchCriteria.project_id);
    }
    
    if (searchCriteria.type) {
      query = query.eq("type", searchCriteria.type);
    }
    
    if (searchCriteria.direction) {
      query = query.eq("direction", searchCriteria.direction);
    }
    
    // Handle date range for timestamp if provided
    if (searchCriteria.date_range) {
      if (searchCriteria.date_range.from) {
        query = query.gte("timestamp", searchCriteria.date_range.from);
      }
      if (searchCriteria.date_range.to) {
        query = query.lte("timestamp", searchCriteria.date_range.to);
      }
    }
  }
  
  const result = await query.limit(limit);
  
  // Remove the nested projects data for cleaner response
  const cleanedData = result.data?.map(communication => {
    const { projects, ...commData } = communication;
    return commData;
  });
  
  return { ...result, data: cleanedData };
}
