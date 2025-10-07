
export function calculateCost(model: string, usage: any): number {
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;

  let promptCost = 0;
  let completionCost = 0;

  switch (model) {
    case "gpt-5-2025-08-07":
      promptCost = (promptTokens / 1000) * 0.03;
      completionCost = (completionTokens / 1000) * 0.06;
      break;
    case "gpt-5-mini-2025-08-07":
      promptCost = (promptTokens / 1000) * 0.01;
      completionCost = (completionTokens / 1000) * 0.03;
      break;
    case "gpt-5-nano-2025-08-07":
      promptCost = (promptTokens / 1000) * 0.005;
      completionCost = (completionTokens / 1000) * 0.015;
      break;
    case "gpt-4o":
      promptCost = (promptTokens / 1000) * 0.01;
      completionCost = (completionTokens / 1000) * 0.03;
      break;
    default:
      console.warn(`Unknown model for cost calculation: ${model}`);
      return 0.0;
  }

  return promptCost + completionCost;
}
