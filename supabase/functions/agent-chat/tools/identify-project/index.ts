
/**
 * Tool to identify projects based on user input (ID, CRM ID, or description)
 * Enhanced with semantic vector search
 */

import { Tool, ToolResult } from '../types.ts';
import { generateOpenAIEmbedding, formatEmbeddingForDB } from '../../utils/embeddingUtils.ts';
import { VectorSearchResult } from '../../utils/types.ts';

export const identifyProject: Tool = {
  name: "identify_project",
  description: "Identifies projects based on ID, CRM ID, or semantic search of description. Use this to find relevant projects when the user mentions a project or asks about a specific project.",
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query (project ID, CRM ID, or descriptive text)"
      },
      company_id: {
        type: "string",
        description: "Optional company ID to filter search to specific company"
      }
    },
    required: ["query"]
  },
  
  async execute(args: any, context: any): Promise<ToolResult> {
    try {
      const { query, company_id } = args;
      
      if (!query) {
        return {
          status: "error",
          error: "Query is required for project identification"
        };
      }
      
      console.log(`Executing identify_project tool: query="${query}"`);

      // First try exact match by ID or CRM ID
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidPattern.test(query)) {
        console.log(`Query appears to be a UUID, searching by ID`);
        const { data: exactMatches, error: exactError } = await context.supabase
          .from('projects')
          .select(`
            id, 
            crm_id, 
            summary, 
            next_step,
            project_track,
            company_id,
            companies(name),
            Address,
            project_name,
            Project_status
          `)
          .eq('id', query)
          .maybeSingle();
          
        if (exactError) {
          console.error("Error in exact ID search:", exactError);
        } else if (exactMatches) {
          return {
            status: "success",
            projects: [{
              id: exactMatches.id,
              crm_id: exactMatches.crm_id,
              summary: exactMatches.summary,
              next_step: exactMatches.next_step,
              address: exactMatches.Address,
              project_name: exactMatches.project_name,
              status: exactMatches.Project_status,
              company: exactMatches.companies?.name
            }],
            found: true,
            count: 1,
            message: `Found exact project match for ID "${query}"`
          };
        }
      } 
      
      // Try exact CRM ID match
      if (/^\d+$/.test(query)) {
        console.log(`Query appears to be a number, searching by CRM ID`);
        const { data: crmMatches, error: crmError } = await context.supabase
          .from('projects')
          .select(`
            id, 
            crm_id, 
            summary, 
            next_step,
            project_track,
            company_id,
            companies(name),
            Address,
            project_name,
            Project_status
          `)
          .eq('crm_id', query)
          .maybeSingle();
          
        if (crmError) {
          console.error("Error in CRM ID search:", crmError);
        } else if (crmMatches) {
          return {
            status: "success",
            projects: [{
              id: crmMatches.id,
              crm_id: crmMatches.crm_id,
              summary: crmMatches.summary,
              next_step: crmMatches.next_step,
              address: crmMatches.Address,
              project_name: crmMatches.project_name,
              status: crmMatches.Project_status,
              company: crmMatches.companies?.name
            }],
            found: true,
            count: 1,
            message: `Found exact project match for CRM ID "${query}"`
          };
        }
      } 
      
      // If no exact matches, try vector search first if available
      console.log(`Attempting semantic vector search for: ${query}`);
      
      try {
        // Generate embedding for the query
        const queryEmbedding = await generateOpenAIEmbedding(query);
        const formattedEmbedding = formatEmbeddingForDB(queryEmbedding);
        
        // Perform vector search
        const { data: vectorResults, error: vectorError } = await context.supabase.rpc(
          'search_projects_by_vector',
          {
            search_embedding: formattedEmbedding,
            match_threshold: 0.2,
            match_count: 5,
            p_company_id: company_id || null
          }
        );
        
        if (vectorError) {
          console.error("Error in vector search:", vectorError);
          // Fall back to traditional search if vector search fails
          return await performTraditionalSearch(query, company_id, context);
        }
        
        if (vectorResults && vectorResults.length > 0) {
          // Get complete project data for each result to ensure we have all the fields we need
          const projectIds = vectorResults.map((p: VectorSearchResult) => p.id);
          const { data: fullProjects, error: projectsError } = await context.supabase
            .from('projects')
            .select(`
              id, 
              crm_id, 
              summary, 
              next_step,
              project_track,
              company_id,
              companies(name),
              Address,
              project_name,
              Project_status
            `)
            .in('id', projectIds);
            
          if (projectsError) {
            console.error("Error getting full project details:", projectsError);
          } else if (fullProjects && fullProjects.length > 0) {
            // Merge the similarity scores with the full project data
            const projectsWithSimilarity = fullProjects.map(project => {
              const vectorResult = vectorResults.find((v: VectorSearchResult) => v.id === project.id);
              return {
                id: project.id,
                crm_id: project.crm_id,
                summary: project.summary,
                next_step: project.next_step,
                address: project.Address,
                project_name: project.project_name,
                status: project.Project_status,
                company: project.companies?.name,
                similarity: vectorResult?.similarity || 0
              };
            });
            
            // Sort by similarity, highest first
            projectsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
            
            return {
              status: "success",
              projects: projectsWithSimilarity,
              found: true,
              count: projectsWithSimilarity.length,
              message: `Found ${projectsWithSimilarity.length} project(s) matching "${query}" using semantic search`
            };
          }
        }
        
        // Fall back to traditional search if vector search returns no results
        console.log("Vector search returned no results or had issues, falling back to traditional search");
        
      } catch (embeddingError) {
        console.error("Error generating embedding or performing vector search:", embeddingError);
      }
      
      // Always perform traditional search as a fallback or if vector search fails
      return await performTraditionalSearch(query, company_id, context);
      
    } catch (error) {
      console.error("Error executing identify_project tool:", error);
      return {
        status: "error",
        error: error.message || "An unexpected error occurred"
      };
    }
  }
};

/**
 * Fallback method that performs traditional text search using ILIKE
 */
async function performTraditionalSearch(query: string, company_id: string | undefined, context: any): Promise<ToolResult> {
  console.log(`Performing traditional text search for: ${query}`);
  
  // Break query into words for more flexible searching
  const searchTerms = query.toLowerCase().trim().split(/\s+/);
  console.log(`Search terms: ${searchTerms.join(', ')}`);
  
  // Start building the query
  let projectsQuery = context.supabase
    .from('projects')
    .select(`
      id, 
      crm_id, 
      summary, 
      next_step,
      project_track,
      company_id,
      companies(name),
      Address,
      project_name,
      Project_status
    `);
    
  // Apply company filter if provided
  if (company_id) {
    projectsQuery = projectsQuery.eq('company_id', company_id);
  }
    
  // Build the filter - search in Address field (case insensitive)
  let filterExpression = '';
  
  // First, try to match the whole query string against the address
  projectsQuery = projectsQuery.or(`Address.ilike.%${query}%`);
  
  // Then try each word separately for better matching
  searchTerms.forEach(term => {
    if (term.length > 2) { // Skip very short words
      projectsQuery = projectsQuery.or(`Address.ilike.%${term}%`);
      projectsQuery = projectsQuery.or(`project_name.ilike.%${term}%`);
      projectsQuery = projectsQuery.or(`summary.ilike.%${term}%`);
    }
  });
  
  // Allow partial numeric / alphanumeric match on CRM ID
  if (!/^\d+$/.test(query.trim())) {
    projectsQuery = projectsQuery.or(`crm_id.ilike.%${query}%`);
  }

  // Execute the query with a reasonable limit
  const { data: projects, error } = await projectsQuery.limit(5);
  
  if (error) {
    console.error("Error searching for projects:", error);
    return {
      status: "error",
      error: `Database error: ${error.message}`
    };
  }
  
  if (!projects || projects.length === 0) {
    console.log(`No projects found matching "${query}"`);
    return {
      status: "success",
      projects: [],
      found: false,
      message: `No projects found matching "${query}"`
    };
  }
  
  console.log(`Found ${projects.length} projects matching "${query}"`);
  
  return {
    status: "success",
    projects: projects.map(p => ({
      id: p.id,
      crm_id: p.crm_id,
      summary: p.summary,
      next_step: p.next_step,
      address: p.Address,
      project_name: p.project_name,
      status: p.Project_status,
      company: p.companies?.name
    })),
    found: true,
    count: projects.length,
    message: `Found ${projects.length} project(s) matching "${query}" using traditional search`
  };
}
