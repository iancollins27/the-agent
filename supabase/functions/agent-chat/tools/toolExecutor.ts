
import { createActionRecordTool } from "./create-action-record/index.ts";
import { dataFetchTool } from "./data-fetch/index.ts";
import { identifyProjectTool } from "./identify-project/index.ts";
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
  
  // Map tool name to actual tool
  switch (toolName) {
    case 'create_action_record':
      return await createActionRecordTool.execute(args, context);
    case 'data_fetch':
      return await dataFetchTool.execute(args, context);
    case 'identify_project':
      return await identifyProjectTool.execute(args, context);
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
    return await executeToolCall(
      context.supabase,
      toolName,
      args,
      context.userProfile,
      context.companyId
    );
  }
};
