
/**
 * Edge function for identifying projects with enhanced security and company isolation
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// CORS headers for browser clients
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a Supabase client with the service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Generates an embedding vector for the given text
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
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
    console.log(`Generated embedding, first 5 values: [ ${embedding.slice(0, 5).join(', ')} ]`);
    
    return embedding;
  } catch (error) {
    console.error(`Error generating embedding: ${error.message}`);
    return null;
  }
}

/**
 * Fetch contacts for a specific project
 */
async function fetchProjectContacts(projectId: string) {
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
    contacts?.forEach((contact, index) => {
      console.log(`Contact ${index+1}: ${contact.full_name}, Role: ${contact.role}, ID: ${contact.id}`);
    });
    
    return contacts || [];
  } catch (error) {
    console.error(`Error in fetchProjectContacts: ${error}`);
    return [];
  }
}

async function identifyProject(
  query: string,
  type: string = "any",
  companyId: string | null = null,
  userId: string | null = null
) {
  try {
    if (!query) {
      return {
        status: "error",
        error: "Query is required to identify a project"
      };
    }
    
    console.log(`Executing identify_project: query="${query}", type=${type}, companyId=${companyId || 'none'}, userId=${userId || 'none'}`);
    
    let projects = [];
    let projectContacts = [];
    
    // Build the base query - if companyId is provided, always filter by it
    let baseQuery = supabase.from('projects').select('id, crm_id, company_id, project_name, summary, next_step, Address, Project_status');
    
    if (companyId) {
      console.log(`Applying company filter: ${companyId}`);
      baseQuery = baseQuery.eq('company_id', companyId);
    }
    
    // First try exact matches
    if (type === "id" || type === "any") {
      // Try UUID format match
      const { data: projectById, error } = await baseQuery.eq('id', query).limit(1);
          
      if (error) {
        console.error(`Error searching by ID: ${error.message}`);
      }
          
      if (projectById && projectById.length > 0) {
        projects = projectById;
        
        // Fetch contacts for this project
        projectContacts = await fetchProjectContacts(projectById[0].id);
        
        return {
          status: "success",
          projects: projectById,
          contacts: projectContacts,
          company_id: projectById[0].company_id,
          project_id: projectById[0].id
        };
      }
    }
    
    if (type === "crm_id" || type === "any") {
      // Try CRM ID match
      const { data: projectByCrmId, error } = await baseQuery.eq('crm_id', query).limit(1);
      
      if (error) {
        console.error(`Error searching by CRM ID: ${error.message}`);
      }
          
      if (projectByCrmId && projectByCrmId.length > 0) {
        projects = projectByCrmId;
        
        // Fetch contacts for this project
        projectContacts = await fetchProjectContacts(projectByCrmId[0].id);
        
        return {
          status: "success",
          projects: projectByCrmId,
          contacts: projectContacts,
          company_id: projectByCrmId[0].company_id,
          project_id: projectByCrmId[0].id
        };
      }
    }
    
    if (type === "name" || type === "any") {
      // Try project name match
      const { data: projectByName, error } = await baseQuery.ilike('project_name', `%${query}%`).limit(3);
      
      if (error) {
        console.error(`Error searching by name: ${error.message}`);
      }
          
      if (projectByName && projectByName.length > 0) {
        projects = [...projectByName];
        
        // If we have at least one project, return immediately
        if (projects.length > 0 && type === "name") {
          // Fetch contacts for the first project
          projectContacts = await fetchProjectContacts(projects[0].id);
          
          return {
            status: "success",
            projects: projects.slice(0, 3),
            contacts: projectContacts,
            company_id: projects[0].company_id,
            project_id: projects[0].id
          };
        }
      }
    }
    
    if (type === "address" || type === "any") {
      // Try address match
      const { data: projectByAddress, error } = await baseQuery.ilike('Address', `%${query}%`).limit(3);
      
      if (error) {
        console.error(`Error searching by address: ${error.message}`);
      }
          
      if (projectByAddress && projectByAddress.length > 0) {
        // Filter out any duplicates that might already be in the projects array
        const newProjects = projectByAddress.filter(
          p1 => !projects.some(p2 => p2.id === p1.id)
        );
        projects = [...projects, ...newProjects];
        
        // If we have at least one project, and we're specifically looking for address, return
        if (projects.length > 0 && type === "address") {
          // Fetch contacts for the first project
          projectContacts = await fetchProjectContacts(projects[0].id);
          
          return {
            status: "success",
            projects: projects.slice(0, 3),
            contacts: projectContacts,
            company_id: projects[0].company_id,
            project_id: projects[0].id
          };
        }
      }
    }
    
    // If we have some projects from the above searches and we're in "any" mode, return them
    if (projects.length > 0) {
      console.log(`Found ${projects.length} projects by ${type !== "any" ? type : "name/address"}`);
      // Fetch contacts for the first project
      projectContacts = await fetchProjectContacts(projects[0].id);
      
      return {
        status: "success",
        projects: projects.slice(0, 3),
        contacts: projectContacts,
        company_id: projects[0].company_id,
        project_id: projects[0].id
      };
    }
    
    // If no matches found yet and companyId is provided, try a vector search
    console.log(`Performing semantic vector search for: ${query}`);
    
    // Get embedding for the query text
    const embedding = await generateEmbedding(query);
    if (!embedding) {
      return {
        status: "error",
        error: "Failed to generate embedding for search"
      };
    }
    
    // Build vector search parameters - always include companyId if available
    const vectorSearchBody: any = {
      searchEmbedding: embedding,
      matchThreshold: 0.2,
      matchCount: 3
    };
    
    if (companyId) {
      vectorSearchBody.companyId = companyId;
      console.log(`Adding company filter ${companyId} to vector search`);
    }
    
    // Use the vector search edge function
    const vectorSearchResponse = await supabase.functions.invoke('search-projects-by-vector', {
      body: vectorSearchBody
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
      
      // Add company filter if available
      let projectQuery = supabase
        .from('projects')
        .select('id, crm_id, company_id, project_name, summary, next_step, Address, Project_status')
        .in('id', projectIds);
        
      if (companyId) {
        projectQuery = projectQuery.eq('company_id', companyId);
      }
      
      const { data: vectorProjects, error } = await projectQuery;
      
      if (error) {
        console.error(`Error fetching full project details: ${error.message}`);
      }
      
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
        projectContacts = await fetchProjectContacts(projects[0].id);
        
        return {
          status: "success",
          projects: projects,
          contacts: projectContacts,
          company_id: projects[0].company_id,
          project_id: projects[0].id
        };
      }
    }
    
    // Return the final result
    if (projects.length > 0) {
      // Fetch contacts for the first project
      projectContacts = await fetchProjectContacts(projects[0].id);
      
      return {
        status: "success",
        projects: projects,
        contacts: projectContacts,
        company_id: projects[0].company_id,
        project_id: projects[0].id
      };
    }
    
    // If still no matches, return empty result
    return {
      status: "success",
      projects: [],
      contacts: [],
      message: "No matching projects found"
    };
    
  } catch (error) {
    console.error("Error in identify_project function:", error);
    return {
      status: "error",
      error: error.message || "An unexpected error occurred"
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { query, type = "any", company_id = null, user_id = null } = await req.json();
    
    // Execute project identification with company ID filtering
    const result = await identifyProject(query, type, company_id, user_id);
    
    // Return the result
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Error in identify-project edge function:", error);
    return new Response(JSON.stringify({ 
      status: "error", 
      error: error.message || "An unexpected error occurred"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
