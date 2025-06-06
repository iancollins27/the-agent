
import { ToolContext } from '../types.ts';

export async function executeIdentifyProject(args: any, context: ToolContext) {
  const { supabase, companyId, userProfile } = context;
  
  try {
    console.log(`identify_project tool called with query: "${args.query}", type: ${args.type || 'any'}`);
    
    if (!args.query) {
      return {
        status: "error",
        error: "Query parameter is required"
      };
    }
    
    // Prepare the request body for the identify-project edge function
    const requestBody = {
      query: args.query,
      type: args.type || 'any',
      company_id: companyId,
      user_id: userProfile?.id
    };
    
    console.log(`Calling identify-project edge function with:`, requestBody);
    
    // Call the identify-project edge function
    const { data, error } = await supabase.functions.invoke('identify-project', {
      body: requestBody
    });
    
    if (error) {
      console.error(`Error calling identify-project edge function:`, error);
      return {
        status: "error",
        error: error.message || "Failed to call identify-project function",
        details: error
      };
    }
    
    console.log(`identify-project edge function response:`, data);
    
    // Return the structured result for the MCP orchestrator to process
    return {
      status: "success",
      ...data,
      message: data.projects?.length > 0 
        ? `Found ${data.projects.length} project(s) matching "${args.query}"` 
        : `No projects found matching "${args.query}"`
    };
    
  } catch (error) {
    console.error(`Exception in identify_project tool:`, error);
    return {
      status: "error",
      error: error.message || "Exception calling identify-project function",
      details: error
    };
  }
}
