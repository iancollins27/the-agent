
import { SupabaseClient } from '@supabase/supabase-js';

export async function logToolCall(
  supabase: SupabaseClient,
  {
    promptRunId,
    name,
    status,
    duration,
    args,
    output,
  }: {
    promptRunId: string;
    name: string;
    status: number;
    duration: number;
    args: any;
    output: string;
  }
) {
  try {
    // Create SHA-256 hash of the input args
    const inputHash = await crypto.subtle.digest(
      "SHA-256", 
      new TextEncoder().encode(JSON.stringify(args))
    );
    const hashHex = Array.from(new Uint8Array(inputHash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Log the tool call
    const { error } = await supabase
      .from("tool_logs")
      .insert({
        prompt_run_id: promptRunId,
        tool_name: name,
        status_code: status,
        duration_ms: duration,
        input_hash: hashHex,
        output_trim: output.slice(0, 300)
      });

    if (error) {
      console.error("Error logging tool call:", error);
    }
  } catch (err) {
    console.error("Error in logToolCall:", err);
  }
}

export async function updatePromptRunMetrics(
  supabase: SupabaseClient,
  promptRunId: string,
  metrics: {
    promptTokens?: number;
    completionTokens?: number;
    usdCost?: number;
  }
) {
  try {
    const { error } = await supabase
      .from("prompt_runs")
      .update({
        prompt_tokens: metrics.promptTokens,
        completion_tokens: metrics.completionTokens,
        usd_cost: metrics.usdCost
      })
      .eq("id", promptRunId);

    if (error) {
      console.error("Error updating prompt run metrics:", error);
    }
  } catch (err) {
    console.error("Error in updatePromptRunMetrics:", err);
  }
}

export async function logActionMetrics(
  supabase: SupabaseClient,
  {
    actionRecordId,
    decision,
    approved,
    executed
  }: {
    actionRecordId: string;
    decision: string;
    approved?: boolean;
    executed?: boolean;
  }
) {
  try {
    const { error } = await supabase
      .from("action_metrics")
      .insert({
        action_record_id: actionRecordId,
        decision,
        approved,
        executed
      });

    if (error) {
      console.error("Error logging action metrics:", error);
    }
  } catch (err) {
    console.error("Error in logActionMetrics:", err);
  }
}
