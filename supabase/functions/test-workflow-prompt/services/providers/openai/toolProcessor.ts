
import { executeToolCall } from "../../../tools/toolExecutor.ts";
import { logToolCall } from "../../../database/tool-logs.ts";

export async function processToolCall(supabase: any, toolName: string, args: any, promptRunId: string, projectId: string) {
  // Simply delegate to the executeToolCall function that uses the tool registry
  return await executeToolCall(supabase, toolName, args, promptRunId, projectId);
}
