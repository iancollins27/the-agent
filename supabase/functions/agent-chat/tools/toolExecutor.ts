
/**
 * Execute tool calls
 */

import { ToolContext } from './types.ts';

// Enhanced authorization check function
async function authorizeAccess(
  supabase: any,
  toolName: string,
  companyId: string | null,
  userProfile: any | null,
  args: any
): Promise<boolean> {
  // Log detailed authorization info
  console.log(`Authorization check for tool ${toolName}`);
  console.log(`Security context - companyId: ${companyId || 'none'}, userProfile: ${userProfile ? `ID: ${userProfile.id}, Company: ${userProfile.company_id}` : 'none'}`);
  
  // If no company ID or user profile provided, security check fails
  // We're enforcing stricter security - require auth for company-specific data
  if (!companyId) {
    console.log(`Company ID is required for security but none provided - access denied`);
    return false;
  }
  
  if (!userProfile) {
    console.log(`User profile is required for security but none provided - access denied`);
    return false;
  }
  
  console.log(`Authorizing ${toolName} for user ${userProfile?.id || 'unknown'} from company ${companyId}`);
  
  // Verify user profile matches company ID
  if (userProfile.company_id !== companyId) {
    console.error(`User company mismatch: User ${userProfile.id} has company ${userProfile.company_id} but claims to be from ${companyId}`);
    return false;
  }
  
  // Add tool-specific authorization logic
  if (toolName === 'identify_project' && args.project_id) {
    const { data: projectData, error } = await supabase
      .from('projects')
      .select('company_id')
      .eq('id', args.project_id)
      .single();
    
    if (error || !projectData) {
      console.error(`Project verification failed for ID ${args.project_id}: ${error?.message || 'Project not found'}`);
      return false;
    }
    
    if (projectData.company_id !== companyId) {
      console.error(`User ${userProfile.id} from company ${companyId} attempted to access project ${args.project_id} belonging to company ${projectData.company_id}`);
      return false;
    }
    
    console.log(`Successfully authorized access to project ${args.project_id}`);
  }
  
  // User is authorized
  console.log(`Authorization successful for ${toolName}`);
  return true;
}

export async function executeToolCall(
  supabase: any, 
  toolName: string, 
  args: any,
  userProfile: any = null,
  companyId: string | null = null
) {
  // Convert underscores in tool names to hyphens for file path compatibility
  // This handles the mismatch between how OpenAI refers to tools (with underscores)
  // and how files are actually named (with hyphens)
  const mappedToolName = toolName.replace(/_/g, '-');
  
  try {
    console.log(`Executing tool ${toolName} (mapped to ${mappedToolName}) with security context - companyId: ${companyId || 'none'}, userId: ${userProfile?.id || 'none'}`);
    
    // Authorization check for company-specific data access
    const isAuthorized = await authorizeAccess(supabase, toolName, companyId, userProfile, args);
    if (!isAuthorized) {
      console.error(`Authorization failure: User ${userProfile?.id || 'unknown'} from company ${companyId} denied access to ${toolName}`);
      return {
        status: "error",
        error: "Unauthorized access",
        details: "You do not have access to the requested data"
      };
    }
    
    // For identify_project tool, always add company_id to the args if provided
    if (toolName === 'identify_project') {
      console.log(`Adding company_id filter ${companyId} to identify_project query`);
      
      if (!companyId) {
        return {
          status: "error",
          error: "Missing company ID",
          details: "Company ID is required for security"
        };
      }
      
      // Always add company_id to arguments for identify_project calls
      args.company_id = companyId;
      
      // For logged-in users, also add user_id for additional context
      if (userProfile?.id) {
        args.user_id = userProfile.id;
        console.log(`Adding user_id ${userProfile.id} to identify_project query for audit purposes`);
      }
      
      return await callIdentifyProjectFunction(supabase, args, userProfile, companyId);
    }
    
    // Import the tool dynamically based on the mapped name
    let toolModule;
    try {
      // For other tools, continue using the module import approach
      toolModule = await import(`./${mappedToolName}/index.ts`);
      console.log(`Successfully imported tool module: ${mappedToolName}`);
    } catch (importError) {
      console.error(`Error importing tool module ${mappedToolName}:`, importError);
      throw new Error(`Failed to import tool module: ${importError.message}`);
    }
    
    // Create tool context
    const context: ToolContext = {
      supabase,
      userProfile,
      companyId
    };
    
    // Different tools might have their export structured differently
    const toolExports = {
      create_action_record: toolModule.createActionRecord,
      read_crm_data: toolModule.readCrmData,
      knowledge_base_lookup: toolModule.knowledgeBaseLookup
    };
    
    // Get the correct tool function
    const toolFunction = toolExports[toolName];
    
    if (!toolFunction) {
      console.error(`Tool function ${toolName} not found in module. Available exports:`, Object.keys(toolModule));
      throw new Error(`Tool function ${toolName} not found in module ${mappedToolName}`);
    }
    
    if (!toolFunction.execute) {
      console.error(`Tool function ${toolName} does not have an execute method. Keys:`, Object.keys(toolFunction));
      throw new Error(`Tool function ${toolName} does not have an execute method`);
    }
    
    console.log(`Executing tool function ${toolName}.execute with args`);
    const result = await toolFunction.execute(args, context);
    console.log(`Tool ${toolName} result:`, JSON.stringify(result).substring(0, 200) + (JSON.stringify(result).length > 200 ? '...' : ''));
    return result;
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      status: "error",
      error: error.message || "Unknown error",
      details: error.stack || "No stack trace available"
    };
  }
}

// Function to call the dedicated identify-project edge function
async function callIdentifyProjectFunction(
  supabase: any,
  args: any,
  userProfile: any | null,
  companyId: string | null
) {
  console.log(`Calling identify-project edge function with args: ${JSON.stringify(args).substring(0, 100)}`);
  console.log(`Security context for identify-project call: companyId: ${companyId || 'none'}, userId: ${userProfile?.id || 'none'}`);
  
  if (!companyId) {
    console.error(`Cannot call identify-project without company_id - security violation`);
    return {
      status: "error",
      error: "Missing company ID",
      message: "Company ID is required for security"
    };
  }
  
  try {
    // Prepare request body with security context
    const requestBody = {
      query: args.query,
      type: args.type || 'any',
      company_id: companyId,  // Always pass company_id for security
      user_id: userProfile?.id || null
    };
    
    console.log(`Final identify-project request: ${JSON.stringify(requestBody)}`);
    
    // Call the identify-project edge function
    const response = await supabase.functions.invoke('identify-project', {
      body: requestBody
    });
    
    if (response.error) {
      console.error('Error from identify-project function:', response.error);
      return {
        status: "error",
        error: response.error,
        message: "Failed to identify project"
      };
    }
    
    console.log(`identify-project function result:`, JSON.stringify(response.data).substring(0, 200));
    return response.data;
  } catch (error) {
    console.error('Exception calling identify-project function:', error);
    return {
      status: "error",
      error: error.message || "Unknown error",
      message: "Exception while identifying project"
    };
  }
}
