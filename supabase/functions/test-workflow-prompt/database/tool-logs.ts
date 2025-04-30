
/**
 * Functions for logging tool calls
 */

/**
 * Log a tool call to the database
 * Updated to match the actual database schema
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
  
  // Create a hash of the tool arguments to store in input_hash
  let inputHash;
  try {
    inputHash = toolArgs ? String(toolArgs).substring(0, 100) : null;
  } catch (e) {
    inputHash = "Error creating input hash";
  }
  
  // Truncate tool result to store in output_trim
  const outputTrim = toolResult && toolResult.length > maxLength 
    ? toolResult.substring(0, maxLength) + "... [truncated]" 
    : toolResult;

  try {
    const { data, error } = await supabase
      .from('tool_logs')
      .insert({
        prompt_run_id: promptRunId,
        tool_name: toolName,
        // Use input_hash instead of tool_args
        input_hash: inputHash,
        // Use output_trim instead of tool_result
        output_trim: outputTrim,
        status_code: statusCode,
        duration_ms: durationMs
        // error_message column doesn't exist, so we don't include it
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

/**
 * Update prompt run with metrics after all tool calls are complete
 */
export async function updatePromptRunMetrics(
  supabase: any,
  promptRunId: string,
  metrics: { 
    total_tokens?: number; 
    prompt_tokens?: number; 
    completion_tokens?: number; 
    usd_cost?: number; 
  }
): Promise<boolean> {
  if (!promptRunId) {
    console.warn("No promptRunId provided for metrics update");
    return false;
  }

  try {
    const { error } = await supabase
      .from('prompt_runs')
      .update({
        prompt_tokens: metrics.prompt_tokens || null,
        completion_tokens: metrics.completion_tokens || null,
        usd_cost: metrics.usd_cost || null
      })
      .eq('id', promptRunId);
    
    if (error) {
      console.error('Error updating prompt run metrics:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Exception in updatePromptRunMetrics:', e);
    return false;
  }
}
