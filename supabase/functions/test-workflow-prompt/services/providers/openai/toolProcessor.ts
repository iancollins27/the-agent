
/**
 * Process OpenAI tool calls using the new tools system
 */
import { executeToolCall } from "../../../tools/toolExecutor.ts";
import { logToolCall } from "../../../database/tool-logs.ts";

export async function processToolCall(supabase: any, toolName: string, args: any, promptRunId: string, projectId: string) {
  // Execute the tool call using the new tool executor
  return await executeToolCall(supabase, toolName, args, promptRunId, projectId);
}
