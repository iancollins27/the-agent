
/**
 * Tool to identify a project based on provided information
 * Now properly respects RLS and user scoping, with special handling for homeowners
 */

import { Tool, ToolResult } from '../types.ts';

export const identifyProjectTool: Tool = {
  name: "identify_project",
  description: "Identifies a project based on provided information like ID, name, or address. For homeowners, automatically returns their associated projects. For company users, searches based on the query. This tool MUST be called before using data_fetch. It returns the correct project_id (UUID) that should be used with other tools like data_fetch.",
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The project identifier, address, or description to search for (optional for homeowners - they get their projects automatically)"
      },
      type: {
        type: "string",
        enum: ["id", "crm_id", "name", "address", "any"],
        description: "Type of query (defaults to 'any', ignored for homeowners)"
      }
    },
    required: []
  },
  
  async execute(args: any, context: any): Promise<ToolResult> {
    try {
      const { query = "", type = "any" } = args;
      
      console.log(`Executing identify_project tool: query="${query}", user context: contact=${context.userProfile?.id}, company=${context.companyId}, role=${context.userProfile?.role}`);
      
      // Log the search attempt
      await context.supabase
        .from('audit_log')
        .insert({
          contact_id: context.userProfile?.id,
          company_id: context.companyId,
          action: 'project_search',
          resource_type: 'project',
          details: { query, search_type: type, user_role: context.userProfile?.role }
        });
      
      let projects = [];
      let projectContacts = [];
      
      // Check if this is a homeowner
      const isHomeowner = context.userProfile?.role === 'homeowner' || context.userProfile?.role === 'HO';
      
      if (isHomeowner && context.userProfile?.id) {
        console.log(`Homeowner detected - fetching projects for contact ${context.userProfile.id}`);
        
        // For homeowners, get their projects directly from project_contacts using the new RLS policies
        // The RLS policies will automatically filter to only show projects they have access to
        const { data: homeownerProjects, error: homeownerError } = await context.supabase
          .from('project_contacts')
          .select(`
            project_id,
            projects!inner(
              id,
              crm_id, 
              company_id,
              project_name,
              summary,
              next_step,
              Address,
              Project_status
            )
          `)
          .eq('contact_id', context.userProfile.id);
        
        if (homeownerError) {
          console.error(`Error fetching homeowner projects: ${homeownerError.message}`);
          return {
            status: "error",
            error: homeownerError.message,
            message: "Could not retrieve your projects"
          };
        }
        
        if (homeownerProjects && homeownerProjects.length > 0) {
          // Transform the data to match expected format
          projects = homeownerProjects.map(pc => pc.projects);
          
          // Get contacts for the first project using new RLS policies
          projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
          
          console.log(`Found ${projects.length} projects for homeowner ${context.userProfile.id}`);
          
          if (projects.length === 1) {
            return {
              status: "success",
              projects: projects,
              contacts: projectContacts,
              company_id: projects[0].company_id, // Include company_id from project for context
              project_id: projects[0].id,
              message: `Found your project: ${projects[0].project_name || projects[0].Address || 'Project'}. Use project_id: ${projects[0].id} for subsequent tool calls like data_fetch.`
            };
          } else {
            // Multiple projects - let homeowner choose
            const projectList = projects.map((p, index) => {
              const details = [
                `#${index + 1}:`,
                p.Address ? `Address: ${p.Address}` : null,
                p.project_name ? `Name: ${p.project_name}` : null,
                p.Project_status ? `Status: ${p.Project_status}` : null
              ].filter(Boolean).join(' ');
              return details;
            }).join('\n');
            
            return {
              status: "success",
              projects: projects,
              contacts: projectContacts,
              company_id: projects[0].company_id, // Include company_id from project for context
              project_id: projects[0].id, // Default to first project
              multipleMatches: true,
              message: `I found ${projects.length} of your projects. Please specify which one you're asking about:\n\n${projectList}\n\nOr I can help with the first one listed.`
            };
          }
        } else {
          return {
            status: "success",
            projects: [],
            contacts: [],
            message: "I couldn't find any projects associated with your account. Please contact your project manager if you believe this is an error."
          };
        }
      }
      
      // For company users, proceed with the existing search logic
      if (!query) {
        return {
          status: "error",
          error: "Query is required for company users to identify a project"
        };
      }
      
      // STRICT SECURITY CHECK: Company ID is REQUIRED for company users
      if (!context.companyId) {
        console.error(`Security violation: No company ID provided for project identification`);
        return {
          status: "error",
          error: "Company ID required",
          message: "For security reasons, you must provide a company ID when searching for projects"
        };
      }
      
      console.log(`Company user search: query="${query}", type=${type}, companyId=${context.companyId}`);
      
      // RLS will automatically filter results based on user's permissions
      // Company users will see their company's projects
      
      // First try exact matches
      if (type === "id" || type === "any") {
        const { data: projectById } = await context.supabase
          .from('projects')
          .select('id, crm_id, company_id, project_name, summary, next_step, Address, Project_status')
          .eq('id', query)
          .limit(1);
          
        if (projectById && projectById.length > 0) {
          projects = projectById;
          
          projectContacts = await fetchProjectContacts(context.supabase, projectById[0].id);
          
          return {
            status: "success",
            projects: projectById,
            contacts: projectContacts,
            company_id: projectById[0].company_id,
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
          
          projectContacts = await fetchProjectContacts(context.supabase, projectByCrmId[0].id);
          
          return {
            status: "success",
            projects: projectByCrmId,
            contacts: projectContacts,
            company_id: projectByCrmId[0].company_id,
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
          
          if (projects.length > 0 && type === "name") {
            projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
            
            return {
              status: "success",
              projects: projects.slice(0, 3),
              contacts: projectContacts,
              company_id: projects[0].company_id,
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
          
          if (projects.length > 0 && type === "address") {
            projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
            
            return {
              status: "success",
              projects: projects.slice(0, 3),
              contacts: projectContacts,
              company_id: projects[0].company_id,
              project_id: projects[0].id,
              message: `Found project(s) by address. Use project_id: ${projects[0].id} for subsequent tool calls like data_fetch.`
            };
          }
        }
      }
      
      if (projects.length > 0) {
        console.log(`Found ${projects.length} projects by ${type !== "any" ? type : "name/address"}`);
        projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
        
        return {
          status: "success",
          projects: projects.slice(0, 3),
          contacts: projectContacts,
          company_id: projects[0].company_id,
          project_id: projects[0].id,
          message: `Found project(s). Use project_id: ${projects[0].id} for subsequent tool calls like data_fetch.`
        };
      }
      
      // If no matches found yet, try a vector search (only for company users)
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
          companyId: context.companyId // Pass the user's company context
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
          
          console.log(`Found ${vectorProjects.length} projects via vector search`);
          
          if (projects.length > 3) {
            projects = projects.slice(0, 3);
          }
          
          projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
          
          return {
            status: "success",
            projects: projects,
            contacts: projectContacts,
            company_id: projects[0].company_id,
            project_id: projects[0].id,
            message: `Found project(s) via semantic search. Use project_id: ${projects[0].id} for subsequent tool calls like data_fetch.`
          };
        }
      }
      
      if (projects.length > 0) {
        projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
        
        return {
          status: "success",
          projects: projects,
          contacts: projectContacts,
          company_id: projects[0].company_id,
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
 * Fetch contacts for a specific project - now works with homeowner RLS policies
 */
async function fetchProjectContacts(supabase: any, projectId: string) {
  try {
    console.log(`Fetching contacts for project: ${projectId}`);
    
    // RLS will automatically filter these based on user permissions
    // For homeowners, the new policies allow them to see contacts on their projects
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
    // For homeowners, the new policies allow them to see contacts on their projects
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
