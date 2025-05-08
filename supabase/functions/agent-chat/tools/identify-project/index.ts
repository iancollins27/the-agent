/**
 * Tool to identify projects based on user input (ID, CRM ID, or description)
 */

import { Tool, ToolResult } from '../types.ts';

export const identifyProject: Tool = {
  name: "identify_project",
  description: "Identifies projects based on ID, CRM ID, or description. Use this to find relevant projects when the user mentions a project or asks about a specific project.",
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
          Project_status
        `);
        
      // Apply company filter if provided
      if (company_id) {
        projectsQuery = projectsQuery.eq('company_id', company_id);
      }
      
      // Try exact ID match
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidPattern.test(query)) {
        console.log(`Query appears to be a UUID, searching by ID`);
        projectsQuery = projectsQuery.eq('id', query);
      } 
      // Try exact CRM ID match
      else if (/^\d+$/.test(query)) {
        console.log(`Query appears to be a number, searching by CRM ID`);
        projectsQuery = projectsQuery.eq('crm_id', query);
      } 
      // Otherwise do a text search
      else {
        console.log(`Performing text search for: ${query}`);
        projectsQuery = projectsQuery.or(`summary.ilike.%${query}%,Address.ilike.%${query}%,crm_id.ilike.%${query}%`);
      }
      
      // Execute the query
      const { data: projects, error } = await projectsQuery.limit(5);
      
      if (error) {
        console.error("Error searching for projects:", error);
        return {
          status: "error",
          error: `Database error: ${error.message}`
        };
      }
      
      if (!projects || projects.length === 0) {
        return {
          status: "success",
          projects: [],
          found: false,
          message: `No projects found matching "${query}"`
        };
      }
      
      return {
        status: "success",
        projects: projects.map(p => ({
          id: p.id,
          crm_id: p.crm_id,
          summary: p.summary,
          next_step: p.next_step,
          address: p.Address,
          status: p.Project_status,
          company: p.companies?.name
        })),
        found: true,
        count: projects.length,
        message: `Found ${projects.length} project(s) matching "${query}"`
      };
    } catch (error) {
      console.error("Error executing identify_project tool:", error);
      return {
        status: "error",
        error: error.message || "An unexpected error occurred"
      };
    }
  }
};
