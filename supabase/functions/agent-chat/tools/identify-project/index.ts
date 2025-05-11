
/**
 * Tool to identify projects based on user input (ID, CRM ID, or description)
 * Enhanced with semantic vector search via edge function
 */

import { Tool, ToolResult } from '../types.ts';
import { generateOpenAIEmbedding } from '../../utils/embeddingUtils.ts';
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
            project_track,
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
              crm_id: exactMatches.crm_id || '',
              summary: exactMatches.summary || '',
              next_step: exactMatches.next_step || '',
              address: exactMatches.Address || '',
              project_name: exactMatches.project_name || '',
              status: exactMatches.Project_status || '',
              company_id: exactMatches.company_id || null,
              company_name: exactMatches.companies?.name || '',
              project_track: exactMatches.project_track || null
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
            project_track,
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
              crm_id: crmMatches.crm_id || '',
              summary: crmMatches.summary || '',
              next_step: crmMatches.next_step || '',
              address: crmMatches.Address || '',
              project_name: crmMatches.project_name || '',
              status: crmMatches.Project_status || '',
              company_id: crmMatches.company_id || null,
              company_name: crmMatches.companies?.name || '',
              project_track: crmMatches.project_track || null
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
        
        // Call our vector search edge function
        console.log("Calling search-projects-by-vector edge function");
        console.log("Vector search parameters:", {
          searchEmbedding: "embedding array", // don't log the full array
          matchThreshold: 0.2,
          matchCount: 20,
          companyId: company_id || null
        });
        
        const { data: vectorSearchResults, error: vectorFunctionError } = await context.supabase.functions.invoke(
          'search-projects-by-vector',
          {
            body: {
              searchEmbedding: queryEmbedding,
              matchThreshold: 0.2,
              matchCount: 20,
              companyId: company_id || null
            }
          }
        );
        
        if (vectorFunctionError) {
          console.error("Error calling vector search edge function:", vectorFunctionError);
          throw new Error(`Vector search function error: ${vectorFunctionError}`);
        }
        
        if (!vectorSearchResults) {
          console.error("No results returned from vector search function");
          throw new Error("No results returned from vector search function");
        }
        
        console.log("Vector search edge function results:", JSON.stringify(vectorSearchResults).substring(0, 300) + "...");
        console.log("Vector search status:", vectorSearchResults.status);
        console.log("Vector search found:", vectorSearchResults.found);
        console.log("Vector search count:", vectorSearchResults.count);
        
        if (vectorSearchResults.status === "success" && vectorSearchResults.projects && vectorSearchResults.projects.length > 0) {
          console.log(`Found ${vectorSearchResults.projects.length} projects via vector search`);
          
          // Log the first few results to help with troubleshooting
          vectorSearchResults.projects.slice(0, 3).forEach((result, i) => {
            console.log(`Result #${i+1} structure:`, Object.keys(result).join(", "));
            console.log(`Result #${i+1} types:`, Object.entries(result).map(([k, v]) => `${k}: ${typeof v}`).join(", "));
            console.log(`Result #${i+1} preview:`, JSON.stringify(result).substring(0, 100) + "...");
          });
          
          return {
            status: "success",
            projects: vectorSearchResults.projects,
            found: true,
            count: vectorSearchResults.projects.length,
            message: `Found ${vectorSearchResults.projects.length} project(s) matching "${query}" using semantic search`
          };
        }
        
        // Fall back to traditional search if vector search returns no results
        console.log("Vector search returned no results, falling back to traditional search");
        return await performTraditionalSearch(query, company_id, context);
        
      } catch (embeddingError) {
        console.error("Error in vector search process:", embeddingError);
        console.log("DEBUG - Embedding error details:", {
          error_message: embeddingError.message,
          error_name: embeddingError.name,
          error_stack: embeddingError.stack
        });
        
        // Fall back to traditional search if there's an error with vector search
        console.log("Error in vector search process, falling back to traditional search");
        return await performTraditionalSearch(query, company_id, context);
      }
    } catch (error) {
      console.error("Error executing identify_project tool:", error);
      console.log("DEBUG - Top level execution error:", {
        error_message: error.message,
        error_name: error.name,
        error_stack: error.stack
      });
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
      project_track,
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
  const { data: projects, error } = await projectsQuery.limit(20);
  
  if (error) {
    console.error("Error searching for projects:", error);
    console.log("DEBUG - Traditional search error:", {
      error_code: error.code,
      error_message: error.message,
      error_details: error.details
    });
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
  
  // Process and format the results
  const processedResults = projects.map((p: any, index: number) => {
    if (index < 3) {
      console.log(`Traditional search result #${index + 1}:`, JSON.stringify(p).substring(0, 200));
      console.log(`Traditional search result #${index + 1} types:`, Object.entries(p).map(([key, value]) => `${key}: ${typeof value}`));
    }
    
    return {
      id: String(p.id || ''),
      crm_id: String(p.crm_id || ''),
      summary: String(p.summary || ''),
      next_step: String(p.next_step || ''),
      address: String(p.Address || ''),
      project_name: String(p.project_name || ''),
      status: String(p.Project_status || ''),
      company_id: p.company_id ? String(p.company_id) : null,
      company_name: String(p.companies?.name || ''),
      project_track: p.project_track ? String(p.project_track) : null
    };
  });
  
  return {
    status: "success",
    projects: processedResults,
    found: true,
    count: processedResults.length,
    message: `Found ${processedResults.length} project(s) matching "${query}" using traditional search`
  };
}
