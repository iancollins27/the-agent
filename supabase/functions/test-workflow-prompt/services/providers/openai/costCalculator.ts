
export function calculateCost(model: string, usage: any): number {
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;

  let promptCost = 0;
  let completionCost = 0;

  switch (model) {
    case "gpt-4o":
      promptCost = (promptTokens / 1000) * 0.01;
      completionCost = (completionTokens / 1000) * 0.03;
      break;
    case "gpt-4-32k":
      promptCost = (promptTokens / 1000) * 0.06;
      completionCost = (completionTokens / 1000) * 0.12;
      break;
    case "gpt-4":
      promptCost = (promptTokens / 1000) * 0.03;
      completionCost = (completionTokens / 1000) * 0.06;
      break;
    case "gpt-3.5-turbo-16k":
    case "gpt-3.5-turbo":
      promptCost = (promptTokens / 1000) * 0.001;
      completionCost = (completionTokens / 1000) * 0.002;
      break;
    default:
      console.warn(`Unknown model for cost calculation: ${model}`);
      return 0.0;
  }

  return promptCost + completionCost;
}
