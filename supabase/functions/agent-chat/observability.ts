
/**
 * Observability utilities for the Agent Chat
 * Handles logging, metrics, and other observability concerns
 */

export interface ConversationMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  toolCalls: number;
  duration: number;
  cost: number;
}

export async function logPromptCompletion(
  supabase: any,
  promptRunId: string,
  finalAnswer: string,
  metrics?: Partial<ConversationMetrics>
): Promise<void> {
  try {
    const updateData: any = {
      prompt_output: finalAnswer,
      status: 'COMPLETED',
      completed_at: new Date().toISOString()
    };
    
    // Add any available metrics
    if (metrics) {
      if (metrics.promptTokens !== undefined) updateData.prompt_tokens = metrics.promptTokens;
      if (metrics.completionTokens !== undefined) updateData.completion_tokens = metrics.completionTokens;
      if (metrics.cost !== undefined) updateData.usd_cost = metrics.cost;
    }
    
    await supabase
      .from('prompt_runs')
      .update(updateData)
      .eq('id', promptRunId);
      
    console.log(`Updated prompt run ${promptRunId} with completion and metrics`);
  } catch (error) {
    console.error('Error logging prompt completion:', error);
  }
}

export function calculateOpenAICost(model: string, tokens: { prompt: number, completion: number }): number {
  const rates: Record<string, { prompt: number, completion: number }> = {
    'gpt-4o': { prompt: 0.000005, completion: 0.000015 },
    'gpt-4o-mini': { prompt: 0.000001, completion: 0.000005 },
    'gpt-4': { prompt: 0.00003, completion: 0.00006 },
    'gpt-3.5-turbo': { prompt: 0.0000005, completion: 0.0000015 }
  };
  
  const rate = rates[model] || rates['gpt-4o-mini'];
  return (tokens.prompt * rate.prompt) + (tokens.completion * rate.completion);
}
