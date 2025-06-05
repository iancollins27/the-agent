
import { createActionRecordTool } from "./create-action-record/index.ts";
import { dataFetchTool } from "./data-fetch/index.ts";
import { readCrmDataTool } from "./read-crm-data/index.ts";
import { sessionManagerTool } from "./session-manager/index.ts";
import { channelResponseTool } from "./channel-response/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Execute a tool call based on its name
export async function executeToolCall(
  supabase: ReturnType<typeof createClient>, 
  toolName: string, 
  args: any,
  userProfile: any,
  companyId: string | null
) {
  const context = {
    supabase,
    userProfile,
    companyId,
    userId: userProfile?.id
  };

  console.log(`Executing tool ${toolName} with args: ${JSON.stringify(args)}`);
  
  // Handle identify_project as external edge function call
  if (toolName === 'identify_project') {
    console.log(`Calling external identify-project edge function with args:`, args);
    
    try {
      // Prepare the request body for the identify-project edge function
      const requestBody = {
        query: args.query || '',
        type: args.type || 'any',
        company_id: companyId,
        user_id: userProfile?.id
      };
      
      console.log(`Invoking identify-project with body:`, requestBody);
      
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
      return data;
      
    } catch (error) {
      console.error(`Exception calling identify-project edge function:`, error);
      return {
        status: "error",
        error: error.message || "Exception calling identify-project function",
        details: error
      };
    }
  }
  
  // Map tool name to actual internal tool
  switch (toolName) {
    case 'create_action_record':
      return await createActionRecordTool.execute(args, context);
    case 'data_fetch':
      return await dataFetchTool.execute(args, context);
    case 'read_crm_data':
      return await readCrmDataTool.execute(args, context);
    case 'session_manager':
      return await sessionManagerTool.execute(args, context);
    case 'channel_response':
      return await channelResponseTool.execute(args, context);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Create the toolExecutor object that agent-chat expects
export const toolExecutor = {
  executeTool: async (toolName: string, args: any, context: any) => {
    // Enhanced context handling for contact-based authentication
    const enhancedContext = {
      ...context,
      // Pass through contact information for homeowner flows
      authenticatedContact: context.authenticatedContact || null,
      authContext: context.authContext || 'web'
    };

    console.log(`Tool execution context: ${JSON.stringify({
      toolName,
      authContext: enhancedContext.authContext,
      userProfile: enhancedContext.userProfile?.id,
      companyId: enhancedContext.companyId,
      projectId: enhancedContext.projectId,
      contactId: enhancedContext.authenticatedContact?.id
    })}`);

    return await executeToolCall(
      enhancedContext.supabase,
      toolName,
      args,
      enhancedContext.userProfile,
      enhancedContext.companyId
    );
  }
};
