
import { logPromptRun, updatePromptRunWithResult } from "../../../database/prompt-runs.ts";
import { updatePromptRunMetrics } from "../../../database/tool-logs.ts";
import { processStandardRequest } from "./standardRequest.ts";
import { processMCPRequest } from "./mcpRequest.ts";
import { calculateCost } from "./costCalculator.ts";

export async function processOpenAIRequest(
  prompt: string,
  model: string,
  supabase: any,
  promptRunId: string,
  projectId: string,
  useMCP: boolean,
  contextData: any
) {
  if (useMCP) {
    return await processMCPRequest(prompt, model, supabase, promptRunId, projectId, contextData);
  } else {
    return await processStandardRequest(prompt, model, supabase, promptRunId);
  }
}

export { calculateCost };
