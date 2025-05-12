
/**
 * Tool to identify a project based on provided information
 */

import { Tool, ToolResult } from '../types.ts';

export const identifyProject: Tool = {
  name: "identify_project",
  description: "Identifies a project based on provided information like ID, name, or address. Use this when the user mentions a specific project or address.",
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
      
      console.log(`Executing identify_project tool: query="${query}"`);
      
      let projects = [];
      
      // First try exact matches
      if (type === "id" || type === "any") {
        // Try UUID format match
        const { data: projectById } = await context.supabase
          .from('projects')
          .select('id, crm_id, project_name, summary, next_step, Address, Project_status')
          .eq('id', query)
          .limit(1);
          
        if (projectById && projectById.length > 0) {
          // Fetch contacts for this project
          const projectContacts = await fetchProjectContacts(context.supabase, projectById[0].id);
          return {
            status: "success",
            projects: projectById,
            contacts: projectContacts
          };
        }
      }
      
      if (type === "crm_id" || type === "any") {
        // Try CRM ID match
        const { data: projectByCrmId } = await context.supabase
          .from('projects')
          .select('id, crm_id, project_name, summary, next_step, Address, Project_status')
          .eq('crm_id', query)
          .limit(1);
          
        if (projectByCrmId && projectByCrmId.length > 0) {
          // Fetch contacts for this project
          const projectContacts = await fetchProjectContacts(context.supabase, projectByCrmId[0].id);
          return {
            status: "success",
            projects: projectByCrmId,
            contacts: projectContacts
          };
        }
      }
      
      if (type === "name" || type === "any") {
        // Try project name match
        const { data: projectByName } = await context.supabase
          .from('projects')
          .select('id, crm_id, project_name, summary, next_step, Address, Project_status')
          .ilike('project_name', `%${query}%`)
          .limit(3);  // Limit to 3 results
          
        if (projectByName && projectByName.length > 0) {
          projects = [...projectByName];
          
          // If we have at least one project, return immediately
          if (projects.length > 0 && type === "name") {
            // Fetch contacts for the first project
            const projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
            return {
              status: "success",
              projects: projects.slice(0, 3),  // Ensure only 3 results max
              contacts: projectContacts
            };
          }
        }
      }
      
      if (type === "address" || type === "any") {
        // Try address match
        const { data: projectByAddress } = await context.supabase
          .from('projects')
          .select('id, crm_id, project_name, summary, next_step, Address, Project_status')
          .ilike('Address', `%${query}%`)
          .limit(3);  // Limit to 3 results
          
        if (projectByAddress && projectByAddress.length > 0) {
          // Filter out any duplicates that might already be in the projects array
          const newProjects = projectByAddress.filter(
            p1 => !projects.some(p2 => p2.id === p1.id)
          );
          projects = [...projects, ...newProjects];
          
          // If we have at least one project, and we're specifically looking for address, return
          if (projects.length > 0 && type === "address") {
            // Fetch contacts for the first project
            const projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
            return {
              status: "success",
              projects: projects.slice(0, 3),  // Ensure only 3 results max
              contacts: projectContacts
            };
          }
        }
      }
      
      // If we have some projects from the above searches and we're in "any" mode, return them
      if (projects.length > 0) {
        console.log(`Found ${projects.length} projects by ${type !== "any" ? type : "name/address"}`);
        // Fetch contacts for the first project
        const projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
        return {
          status: "success",
          projects: projects.slice(0, 3),  // Ensure only 3 results max
          contacts: projectContacts
        };
      }
      
      // If no matches found yet, try a vector search
      console.log(`Performing semantic vector search for: ${query}`);
      
      // Get embedding for the query text
      const embedding = await generateEmbedding(query, context);
      if (!embedding) {
        return {
          status: "error",
          error: "Failed to generate embedding for search"
        };
      }
      
      // Use the vector search edge function
      const vectorSearchResponse = await context.supabase.functions.invoke('search-projects-by-vector', {
        body: {
          searchEmbedding: embedding,
          matchThreshold: 0.2,
          matchCount: 3,  // Limit to 3 results
          companyId: null // Allow searching across all companies
        }
      });
      
      if (vectorSearchResponse.error) {
        console.error('Vector search error:', vectorSearchResponse.error);
        return {
          status: "error",
          error: `Vector search failed: ${vectorSearchResponse.error.message}`
        };
      }
      
      // Log vector search details
      console.log(`Vector search status: ${vectorSearchResponse.data?.status}`);
      console.log(`Vector search found: ${vectorSearchResponse.data?.projects?.length > 0}`);
      console.log(`Vector search count: ${vectorSearchResponse.data?.projects?.length}`);
      
      if (vectorSearchResponse.data?.status === 'success' && 
          vectorSearchResponse.data?.projects?.length > 0) {
        
        // Get the full project details for the top matching projects
        const projectIds = vectorSearchResponse.data.projects
          .slice(0, 3) // Limit to top 3 matches
          .map(p => p.id);
        
        const { data: vectorProjects } = await context.supabase
          .from('projects')
          .select('id, crm_id, project_name, summary, next_step, Address, Project_status')
          .in('id', projectIds);
        
        if (vectorProjects && vectorProjects.length > 0) {
          // Combine with any previously found projects, ensuring no duplicates
          const existingIds = new Set(projects.map(p => p.id));
          const newProjects = vectorProjects.filter(p => !existingIds.has(p.id));
          projects = [...projects, ...newProjects];
          
          console.log(`Found ${vectorProjects.length} projects via vector search`);
          
          // Make sure we have only 3 projects total
          if (projects.length > 3) {
            projects = projects.slice(0, 3);
          }
          
          // Fetch contacts for the first project
          const projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
          return {
            status: "success",
            projects: projects,
            contacts: projectContacts
          };
        }
      }
      
      // Return the final result
      if (projects.length > 0) {
        // Fetch contacts for the first project
        const projectContacts = await fetchProjectContacts(context.supabase, projects[0].id);
        return {
          status: "success",
          projects: projects,
          contacts: projectContacts
        };
      }
      
      // If still no matches, return empty result
      return {
        status: "success",
        projects: [],
        message: "No matching projects found"
      };
      
    } catch (error) {
      console.error("Error in identify_project tool:", error);
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
    
    // Query project_contacts to get the contact_ids for this project
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
    
    // Get all the contact IDs for this project
    const contactIds = projectContacts.map(pc => pc.contact_id);
    
    // Query the contacts table to get the full contact information
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, full_name, role, email, phone_number')
      .in('id', contactIds);
    
    if (contactsError) {
      console.error("Error fetching contact details:", contactsError);
      return [];
    }
    
    console.log(`Successfully retrieved ${contacts?.length || 0} contacts for project ${projectId}`);
    
    return contacts || [];
  } catch (error) {
    console.error(`Error in fetchProjectContacts: ${error}`);
    return [];
  }
}
