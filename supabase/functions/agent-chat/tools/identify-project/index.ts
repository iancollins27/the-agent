
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

      // Check if we have a supabase client
      if (!context.supabase) {
        return {
          status: "error",
          error: "Supabase client is not available",
          message: "Cannot perform project search without database connection"
        };
      }

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
          console.log("Exact match found by ID, data:", JSON.stringify(exactMatches));
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
              company_id: exactMatches.company_id,
              company_name: exactMatches.companies?.name
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
          console.log("Exact match found by CRM ID, data:", JSON.stringify(crmMatches));
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
              company_id: crmMatches.company_id,
              company_name: crmMatches.companies?.name
            }],
            found: true,
            count: 1,
            message: `Found exact project match for CRM ID "${query}"`
          };
        }
      } 
      
      // If no exact matches, perform semantic search using embeddings
      console.log(`Performing semantic vector search for: ${query}`);
      
      try {
        // Generate embedding for the query
        const queryEmbedding = await generateOpenAIEmbedding(query);
        console.log("Generated embedding for query, first 5 values:", queryEmbedding.slice(0, 5));
        
        const formattedEmbedding = formatEmbeddingForDB(queryEmbedding);
        
        // Debug: Log the SQL query parameters before execution
        console.log(`Vector search params: threshold=0.2, count=5, company_id=${company_id || 'null'}`);
        
        // Perform vector search
        console.log("Executing vector search with RPC call to 'search_projects_by_vector'");
        
        // Log the SQL function signature and expected return types
        console.log("SQL Function: search_projects_by_vector(search_embedding vector, match_threshold double precision, match_count integer, p_company_id uuid)");
        console.log("Expected return columns: id, crm_id, summary, next_step, company_id, company_name, address, status, similarity, project_name");
        
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
          console.error("Full error details:", JSON.stringify(vectorError));
          // Fall back to traditional search if vector search fails
          console.log("Vector search failed, falling back to traditional search");
          return await performTraditionalSearch(query, company_id, context);
        }
        
        console.log("Vector search results received:", vectorResults ? vectorResults.length : 0);
        if (vectorResults && vectorResults.length > 0) {
          // Debug each result from vector search
          vectorResults.forEach((result: any, index: number) => {
            console.log(`Vector result #${index + 1}:`, JSON.stringify(result));
          });
          
          // Get complete project data for each result to ensure we have all the fields we need
          const projectIds = vectorResults.map((p: any) => p.id);
          console.log("Fetching full project details for IDs:", projectIds);
          
          const { data: fullProjects, error: projectsError } = await context.supabase
            .from('projects')
            .select(`
              id, 
              crm_id, 
              summary, 
              next_step,
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
            // Debug full project details
            console.log(`Retrieved ${fullProjects.length} full project details`);
            fullProjects.forEach((project: any, index: number) => {
              console.log(`Full project #${index + 1}:`, JSON.stringify(project));
            });
            
            // Merge the similarity scores with the full project data
            const projectsWithSimilarity = fullProjects.map(project => {
              const vectorResult = vectorResults.find((v: any) => v.id === project.id);
              console.log(`Mapping project ${project.id} with similarity ${vectorResult?.similarity || 0}`);
              
              return {
                id: project.id,
                crm_id: project.crm_id,
                summary: project.summary,
                next_step: project.next_step,
                address: project.Address,
                project_name: project.project_name,
                status: project.Project_status,
                company_id: project.company_id,
                company_name: project.companies?.name,
                similarity: vectorResult?.similarity || 0
              };
            });
            
            // Sort by similarity, highest first
            projectsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
            
            console.log("Final processed results:", JSON.stringify(projectsWithSimilarity));
            
            return {
              status: "success",
              projects: projectsWithSimilarity,
              found: true,
              count: projectsWithSimilarity.length,
              message: `Found ${projectsWithSimilarity.length} project(s) matching "${query}" using semantic search`
            };
          }
          
          // Return vector search results directly if we couldn't get full project details
          console.log("Using direct vector results as fallback");
          
          // Debug the actual structure of each vector result
          vectorResults.forEach((result: any, index: number) => {
            console.log(`Vector result #${index + 1} keys:`, Object.keys(result));
            console.log(`Vector result #${index + 1} types:`, Object.entries(result).map(([k, v]) => `${k}: ${typeof v}`));
          });
          
          const mappedResults = vectorResults.map((p: any) => {
            // Create a clean object with explicit type mapping
            const mappedResult = {
              id: String(p.id),
              crm_id: String(p.crm_id || ''),
              summary: String(p.summary || ''),
              next_step: String(p.next_step || ''),
              address: String(p.address || ''),
              project_name: String(p.project_name || ''),
              status: String(p.status || ''),
              company_id: String(p.company_id || ''),
              company_name: String(p.company_name || ''),
              similarity: Number(p.similarity || 0)
            };
            
            console.log(`Mapped vector result:`, JSON.stringify(mappedResult));
            return mappedResult;
          });
          
          return {
            status: "success",
            projects: mappedResults,
            found: true,
            count: mappedResults.length,
            message: `Found ${mappedResults.length} project(s) matching "${query}" using semantic search`
          };
        }
        
        // Fall back to traditional search if vector search returns no results
        console.log("Vector search returned no results, falling back to traditional search");
        return await performTraditionalSearch(query, company_id, context);
        
      } catch (embeddingError) {
        console.error("Error generating embedding or performing vector search:", embeddingError);
        // Fall back to traditional search if there's an error with vector search
        console.log("Error in vector search process, falling back to traditional search");
        return await performTraditionalSearch(query, company_id, context);
      }
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
  
  // Check if we have a supabase client
  if (!context || !context.supabase) {
    return {
      status: "error",
      error: "Supabase client is not available",
      message: "Cannot perform traditional search without database connection"
    };
  }
  
  // Break query into words, drop very common / non-informative tokens.
  const stopWords = new Set(['county', 'project', 'the', 'a', 'an', 'in', 'at', 'of']);
  const searchTerms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 3 && !stopWords.has(t));

  console.log("Search terms after filtering:", searchTerms);

  let projectsQuery = context.supabase
    .from('projects')
    .select(`
      id, 
      crm_id, 
      summary, 
      next_step,
      company_id,
      companies(name),
      Address,
      project_name,
      Project_status
    `);
    
  // Apply company filter if provided
  if (company_id) {
    console.log(`Filtering by company_id: ${company_id}`);
    projectsQuery = projectsQuery.eq('company_id', company_id);
  }
    
  // Fix: Instead of using comma-separated OR conditions which can break with addresses,
  // we'll use multiple .or() filters chained together
  console.log(`Adding OR condition: Address.ilike.%${query}%`);
  projectsQuery = projectsQuery.or(`Address.ilike.%${query}%`);
  
  // Add additional OR conditions
  console.log(`Adding OR condition: summary.ilike.%${query}%`);
  projectsQuery = projectsQuery.or(`summary.ilike.%${query}%`);
  
  console.log(`Adding OR condition: project_name.ilike.%${query}%`);
  projectsQuery = projectsQuery.or(`project_name.ilike.%${query}%`);
  
  // Allow partial numeric / alphanumeric match on CRM ID as a tertiary signal
  if (!/^\d+$/.test(query.trim())) {
    console.log(`Adding OR condition: crm_id.ilike.%${query}%`);
    projectsQuery = projectsQuery.or(`crm_id.ilike.%${query}%`);
  }

  // Execute the query
  console.log("Executing traditional search query");
  const { data: projects, error } = await projectsQuery.limit(5);
  
  if (error) {
    console.error("Error searching for projects:", error);
    return {
      status: "error",
      error: `Database error: ${error.message}`
    };
  }
  
  console.log(`Traditional search results: ${projects ? projects.length : 0} projects found`);
  
  if (!projects || projects.length === 0) {
    return {
      status: "success",
      projects: [],
      found: false,
      message: `No projects found matching "${query}"`
    };
  }
  
  // Debug each project
  projects.forEach((p: any, index: number) => {
    console.log(`Traditional search result #${index + 1}:`, JSON.stringify(p));
  });
  
  // Ensure the returned object has all necessary fields with proper types
  const processedResults = projects.map((p: any) => {
    const result = {
      id: p.id,
      crm_id: p.crm_id,
      summary: p.summary,
      next_step: p.next_step,
      address: p.Address,
      project_name: p.project_name,
      status: p.Project_status,
      company_id: p.company_id,
      company_name: p.companies?.name
    };
    
    console.log(`Processed traditional result:`, JSON.stringify(result));
    return result;
  });
  
  return {
    status: "success",
    projects: processedResults,
    found: true,
    count: processedResults.length,
    message: `Found ${processedResults.length} project(s) matching "${query}" using traditional search`
  };
}
