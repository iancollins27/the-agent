
/**
 * Functions for logging tool calls
 */

/**
 * Log a tool call to the database
 */
export async function logToolCall(
  supabase: any,
  promptRunId: string,
  toolName: string,
  toolCallId: string,
  toolArgs: string,
  toolResult: string,
  statusCode: number,
  durationMs: number,
  errorMessage?: string | null
): Promise<any> {
  if (!promptRunId) {
    console.warn("No promptRunId provided for tool call logging");
    return null;
  }
  
  // Truncate long inputs/outputs to avoid database issues
  const maxLength = 10000;
  const truncatedArgs = toolArgs && toolArgs.length > maxLength 
    ? toolArgs.slice(0, maxLength) + "... [truncated]" 
    : toolArgs;
  
  const truncatedResult = toolResult && toolResult.length > maxLength 
    ? toolResult.slice(0, maxLength) + "... [truncated]" 
    : toolResult;

  try {
    const { data, error } = await supabase
      .from('tool_logs')
      .insert({
        prompt_run_id: promptRunId,
        tool_name: toolName,
        tool_call_id: toolCallId,
        tool_args: truncatedArgs,
        tool_result: truncatedResult,
        status_code: statusCode,
        duration_ms: durationMs,
        error_message: errorMessage
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error logging tool call:', error);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('Exception in logToolCall:', e);
    return null;
  }
}
