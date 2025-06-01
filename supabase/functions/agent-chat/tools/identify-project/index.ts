/**
 * Tool to identify a project based on provided information
 * Now properly respects RLS and user scoping
 */

import { Tool, ToolResult } from '../types.ts';

export const identifyProjectTool: Tool = {
  name: "identify_project",
  description: "Identifies a project based on provided information like ID, name, or address. This tool MUST be called before using data_fetch. It returns the correct project_id (UUID) that should be used with other tools like data_fetch. Respects user permissions - company users see company projects, homeowners see only their projects.",
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The project identifier, address, or description to search for"
      },
      type: {
        type: "string",
        enum: ["id", "crm_id", "name", "address", "any"],
        description: "Type of query (defaults to 'any')"
      }
    },
    required: ["query"]
  },
  
  async execute(args: any, context: any): Promise<ToolResult> {
    try {
      const { query, type = "any" } = args;
      
      if (!query) {
        return {
          status: "error",
          error: "Query is required to identify a project"
        };
      }
      
      console.log(`Executing identify_project tool: query="${query}", user context: contact=${context.userProfile?.id}, company=${context.companyId}`);
      
      // Log the search attempt
      await context.supabase
        .from('audit_log')
        .insert({
          contact_id: context.userProfile?.id,
          company_id: context.companyId,
          action: 'project_search',
          resource_type: 'project',
          details: { query, search_type: type }
        });
      
      let projects = [];
      let projectContacts = [];
      let companyId = context.companyId;
      
      // RLS will automatically filter results based on user's permissions
      // Company users will see their company's projects
      // Homeowners will see only projects they're associated with
      
      // First try exact matches
      if (type === "id" || type === "any") {
        const { data: projectById } = await context.supabase
          .from('projects')
          .select('id, crm_id, company_id, project_name, summary, next_step, Address, Project_status')
          .eq('id', query)
          .limit(1);
          
        if (projectById && projectById.length > 0) {
          projects = projectById;
          companyId = projectById[0].company_id;
          
          projectContacts = await fetchProjectContacts(context.supabase, projectById[0].id);
          
          return {
            status: "success",
            projects: projectById,
            contacts: projectContacts,
            company_id: companyId,
            project_id: projectById[0].id,
            message: `Found project by UUID. Use project_id: ${projectById[0].id} for subsequent tool calls like data_fetch.`
          };
        }
      }
      
      if (type === "crm_id" || type === "any") {
        const { data: projectByCrmId } = await context.supabase
          .from('projects')
          .select('id, crm_id, company_id, project_name, summary, next_step, Address, Project_status')
          .eq('crm_id', query)
          .limit(1);
          
        if (projectByCrmId && projectByCrmId.length > 0) {
          projects = projectByCrmId;
          companyId = projectByCrmId[0].company_id;
          
          projectContacts = await fetchProjectContacts(context.supabase, projectByCrmId[0].id);
          
          return {
            status: "success",
            projects: projectByCrmId,
            contacts: projectContacts,
            company_id: companyId,
            project_id: projectByCrmId[0].id,
            message: `Found project by CRM ID. Use project_id: ${projectByCrmId[0].id} for subsequent tool calls like data_fetch.`
          };
        }
      }
      
      if (type === "name" || type === "any") {
        const { data: projectByName } = await context.supabase
          .from('projects')
          .select('id, crm_id, company_id, project_name, summary, next_step, Address, Project_status')
          .ilike('project_name', `%${query}%`)
          .limit(3);
          
        if (projectByName && projectByName.length > 0) {
          projects = [...projectByName];
          companyId = projectByName[0].company_id;
          
          if (projects.length > 0 && type === "name") {
            projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
            
            return {
              status: "success",
              projects: projects.slice(0, 3),
              contacts: projectContacts,
              company_id: companyId,
              project_id: projects[0].id,
              message: `Found project(s) by name. Use project_id: ${projects[0].id} for subsequent tool calls like data_fetch.`
            };
          }
        }
      }
      
      if (type === "address" || type === "any") {
        const { data: projectByAddress } = await context.supabase
          .from('projects')
          .select('id, crm_id, company_id, project_name, summary, next_step, Address, Project_status')
          .ilike('Address', `%${query}%`)
          .limit(3);
          
        if (projectByAddress && projectByAddress.length > 0) {
          const newProjects = projectByAddress.filter(
            p1 => !projects.some(p2 => p2.id === p1.id)
          );
          projects = [...projects, ...newProjects];
          companyId = projectByAddress[0].company_id;
          
          if (projects.length > 0 && type === "address") {
            projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
            
            return {
              status: "success",
              projects: projects.slice(0, 3),
              contacts: projectContacts,
              company_id: companyId,
              project_id: projects[0].id,
              message: `Found project(s) by address. Use project_id: ${projects[0].id} for subsequent tool calls like data_fetch.`
            };
          }
        }
      }
      
      if (projects.length > 0) {
        console.log(`Found ${projects.length} projects by ${type !== "any" ? type : "name/address"}`);
        projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
        companyId = projects[0].company_id;
        
        return {
          status: "success",
          projects: projects.slice(0, 3),
          contacts: projectContacts,
          company_id: companyId,
          project_id: projects[0].id,
          message: `Found project(s). Use project_id: ${projects[0].id} for subsequent tool calls like data_fetch.`
        };
      }
      
      // If no matches found yet, try a vector search (if user has permission to search)
      console.log(`Performing semantic vector search for: ${query}`);
      
      const embedding = await generateEmbedding(query, context);
      if (!embedding) {
        return {
          status: "error",
          error: "Failed to generate embedding for search"
        };
      }
      
      // Vector search will also respect RLS
      const vectorSearchResponse = await context.supabase.functions.invoke('search-projects-by-vector', {
        body: {
          searchEmbedding: embedding,
          matchThreshold: 0.2,
          matchCount: 3,
          companyId: companyId // Pass the user's company context
        }
      });
      
      if (vectorSearchResponse.error) {
        console.error('Vector search error:', vectorSearchResponse.error);
        return {
          status: "error",
          error: `Vector search failed: ${vectorSearchResponse.error.message}`
        };
      }
      
      console.log(`Vector search status: ${vectorSearchResponse.data?.status}`);
      console.log(`Vector search found: ${vectorSearchResponse.data?.projects?.length > 0}`);
      
      if (vectorSearchResponse.data?.status === 'success' && 
          vectorSearchResponse.data?.projects?.length > 0) {
        
        const projectIds = vectorSearchResponse.data.projects
          .slice(0, 3)
          .map(p => p.id);
        
        // This query will also be filtered by RLS
        const { data: vectorProjects } = await context.supabase
          .from('projects')
          .select('id, crm_id, company_id, project_name, summary, next_step, Address, Project_status')
          .in('id', projectIds);
        
        if (vectorProjects && vectorProjects.length > 0) {
          const existingIds = new Set(projects.map(p => p.id));
          const newProjects = vectorProjects.filter(p => !existingIds.has(p.id));
          projects = [...projects, ...newProjects];
          companyId = vectorProjects[0].company_id;
          
          console.log(`Found ${vectorProjects.length} projects via vector search`);
          
          if (projects.length > 3) {
            projects = projects.slice(0, 3);
          }
          
          projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
          
          return {
            status: "success",
            projects: projects,
            contacts: projectContacts,
            company_id: companyId,
            project_id: projects[0].id,
            message: `Found project(s) via semantic search. Use project_id: ${projects[0].id} for subsequent tool calls like data_fetch.`
          };
        }
      }
      
      if (projects.length > 0) {
        projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
        companyId = projects[0].company_id;
        
        return {
          status: "success",
          projects: projects,
          contacts: projectContacts,
          company_id: companyId,
          project_id: projects[0].id,
          message: `Found project(s). Use project_id: ${projects[0].id} for subsequent tool calls like data_fetch.`
        };
      }
      
      return {
        status: "success",
        projects: [],
        contacts: [],
        message: "No matching projects found that you have access to"
      };
      
    } catch (error) {
      console.error("Error in identify_project tool:", error);
      
      // Log the error
      await context.supabase
        .from('audit_log')
        .insert({
          contact_id: context.userProfile?.id,
          company_id: context.companyId,
          action: 'project_search_error',
          resource_type: 'project',
          details: { query: args.query, error: error.message }
        });
      
      return {
        status: "error",
        error: error.message || "An unexpected error occurred"
      };
    }
  }
};

/**
 * Generates an embedding vector for the given text
 */
async function generateEmbedding(text: string, context: any): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`OpenAI embeddings API error: ${error}`);
      return null;
    }
    
    const data = await response.json();
    const embedding = data.data[0].embedding;
    
    // Log just the first few values of the embedding for debugging
    console.log(`Generated embedding for query, first 5 values: [ ${embedding.slice(0, 5).join(', ')} ]`);
    
    return embedding;
  } catch (error) {
    console.error(`Error generating embedding: ${error.message}`);
    return null;
  }
}

/**
 * Fetch contacts for a specific project
 */
async function fetchProjectContacts(supabase: any, projectId: string) {
  try {
    console.log(`Fetching contacts for project: ${projectId}`);
    
    // RLS will automatically filter these based on user permissions
    const { data: projectContacts, error: projectContactsError } = await supabase
      .from('project_contacts')
      .select('contact_id')
      .eq('project_id', projectId);
    
    if (projectContactsError) {
      console.error("Error fetching project_contacts:", projectContactsError);
      return [];
    }
    
    if (!projectContacts || projectContacts.length === 0) {
      console.log("No contacts found for this project");
      return [];
    }
    
    const contactIds = projectContacts.map(pc => pc.contact_id);
    
    // RLS will filter contacts based on user permissions
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, full_name, role, email, phone_number')
      .in('id', contactIds);
    
    if (contactsError) {
      console.error("Error fetching contact details:", contactsError);
      return [];
    }
    
    console.log(`Successfully retrieved ${contacts?.length || 0} contacts for project ${projectId}`);
    contacts?.forEach((contact, index) => {
      console.log(`Contact ${index+1}: ${contact.full_name}, Role: ${contact.role}, ID: ${contact.id}`);
    });
    
    return contacts || [];
  } catch (error) {
    console.error(`Error in fetchProjectContacts: ${error}`);
    return [];
  }
}
