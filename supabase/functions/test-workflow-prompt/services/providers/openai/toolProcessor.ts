
import { executeToolCall } from "../../../tools/toolExecutor.ts";
import { logToolCall } from "../../../database/tool-logs.ts";

export async function processToolCall(
  supabase: any, 
  toolName: string, 
  args: any, 
  promptRunId: string, 
  projectId: string,
  companyId?: string,
  userProfile?: any
) {
  // Add more detailed logging to trace where company ID might be lost
  console.log(`Processing tool call: ${toolName} with args: ${JSON.stringify(args).substring(0, 100)}`);
  console.log(`Security context - companyId: ${companyId || 'none'}, userProfile: ${userProfile ? JSON.stringify({id: userProfile.id, company_id: userProfile.company_id}) : 'none'}`);
  
  // STRICT SECURITY: Always require company ID for identify_project
  if (toolName === 'identify_project' && !companyId) {
    console.error(`Security violation: identify_project called without company ID`);
    return {
      status: "error",
      error: "Missing company ID",
      message: "For security reasons, company ID is required for project identification"
    };
  }
  
  // Simply delegate to the executeToolCall function that uses the tool registry
  // But ensure company ID and user profile are passed for access control
  return await executeToolCall(
    supabase, 
    toolName, 
    args, 
    promptRunId, 
    projectId,
    companyId,
    userProfile
  );
}
