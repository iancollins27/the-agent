
// Import necessary types
import { ToolContext } from '../types.ts';

export async function identifyProject(args: any, context: ToolContext) {
  const { supabase, userProfile, companyId } = context;
  
  // Security check: Verify company context is available
  if (!companyId || !userProfile) {
    console.error("Security error: Missing company context in identify-project tool");
    return {
      status: "error",
      error: "Authentication required to access projects"
    };
  }
  
  const { query, strategy = "fuzzy", return_all = false, exact_match = false } = args;
  
  if (!query) {
    return {
      status: "error",
      error: "Query parameter is required to identify a project"
    };
  }
  
  console.log(`Identifying project with query: ${query}, strategy: ${strategy}, company_id: ${companyId}`);
  
  try {
    let projects = [];
    
    if (strategy === "fuzzy" && query.length > 3) {
      // Create embedding for the search string
      const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`
        },
        body: JSON.stringify({
          input: query,
          model: "text-embedding-3-small"
        })
      });
      
      if (!embeddingResponse.ok) {
        const error = await embeddingResponse.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }
      
      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;
      
      // Use the vector search function with company ID filter
      const { data: vectorResults, error: vectorError } = await supabase.rpc(
        'search_projects_by_vector',
        { 
          search_embedding: embedding,
          match_threshold: 0.2,
          match_count: return_all ? 20 : 5,
          p_company_id: companyId  // Important: Filter by company ID
        }
      );
      
      if (vectorError) {
        console.error("Vector search error:", vectorError);
        throw vectorError;
      }
      
      projects = vectorResults;
    } else {
      // For exact match or shorter queries, use direct database query
      // with company ID filter
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          crm_id,
          project_name,
          Address as address,
          company_id,
          next_step,
          Project_status as status,
          summary
        `)
        .eq('company_id', companyId)  // Important: Filter by company ID
        .or(`crm_id.ilike.%${query}%,Address.ilike.%${query}%,project_name.ilike.%${query}%`)
        .limit(return_all ? 20 : 5);
      
      if (error) {
        console.error("Direct query error:", error);
        throw error;
      }
      
      projects = data;
    }
    
    // If exact match is required, filter to exact matches only
    if (exact_match && projects.length > 0) {
      projects = projects.filter(p => 
        (p.crm_id && p.crm_id.toLowerCase() === query.toLowerCase()) ||
        (p.address && p.address.toLowerCase() === query.toLowerCase()) ||
        (p.project_name && p.project_name.toLowerCase() === query.toLowerCase())
      );
    }
    
    // If no projects found, return appropriate message
    if (projects.length === 0) {
      return {
        status: "success",
        projects: [],
        message: `No projects found matching "${query}"`
      };
    }
    
    // Get project contacts if we found any projects
    if (projects.length > 0) {
      const projectIds = projects.map(p => p.id);
      const { data: contacts, error: contactsError } = await supabase
        .from('project_contacts')
        .select(`
          project_id,
          contacts:contact_id (
            id, full_name, role, email, phone_number
          )
        `)
        .in('project_id', projectIds);
      
      if (!contactsError && contacts) {
        // Group contacts by project
        const contactsByProject = {};
        contacts.forEach(item => {
          if (item.contacts) {
            if (!contactsByProject[item.project_id]) {
              contactsByProject[item.project_id] = [];
            }
            contactsByProject[item.project_id].push(item.contacts);
          }
        });
        
        // Return results with project contacts included
        return {
          status: "success",
          projects: projects,
          company_id: companyId,
          contacts: return_all ? Object.values(contactsByProject).flat() : contactsByProject[projects[0].id] || [],
          project_id: projects.length === 1 ? projects[0].id : null
        };
      }
    }
    
    // Return results without contacts (fallback)
    return {
      status: "success",
      projects: projects,
      company_id: companyId,
      project_id: projects.length === 1 ? projects[0].id : null
    };
    
  } catch (error) {
    console.error("Error in identifyProject:", error);
    return {
      status: "error",
      error: error.message
    };
  }
}
