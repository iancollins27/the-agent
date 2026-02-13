
import { MODEL_COSTS } from '../../../../_shared/aiConfig.ts';

export function calculateCost(model: string, usage: any): number {
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;

  const costs = MODEL_COSTS[model];
  if (!costs) {
    console.warn(`Unknown model for cost calculation: ${model}`);
    return 0.0;
  }

  const promptCost = (promptTokens / 1000) * costs.prompt;
  const completionCost = (completionTokens / 1000) * costs.completion;

  return promptCost + completionCost;
}
