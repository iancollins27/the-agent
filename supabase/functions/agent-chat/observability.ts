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

export interface LogObservabilityParams {
  supabase: any;
  projectId?: string;
  userProfile?: any;
  companyId?: string;
  messages: any[];
  response: any;
  toolCalls: any[];
  model: string;
  usage?: any;
}

export async function logObservability(params: LogObservabilityParams): Promise<void> {
  try {
    const {
      supabase,
      projectId,
      userProfile,
      companyId,
      messages,
      response,
      toolCalls,
      model,
      usage
    } = params;

    // Calculate metrics
    const metrics: Partial<ConversationMetrics> = {};
    if (usage) {
      metrics.promptTokens = usage.prompt_tokens || 0;
      metrics.completionTokens = usage.completion_tokens || 0;
      metrics.totalTokens = usage.total_tokens || 0;
      metrics.cost = calculateOpenAICost(model, {
        prompt: metrics.promptTokens,
        completion: metrics.completionTokens
      });
    }
    
    metrics.toolCalls = toolCalls?.length || 0;

    // Create a prompt run record for observability
    const promptRunData = {
      project_id: projectId,
      model: model,
      prompt_input: JSON.stringify({
        messages: messages,
        model: model,
        tools_available: toolCalls?.length > 0
      }),
      prompt_output: JSON.stringify(response),
      status: 'COMPLETED',
      prompt_tokens: metrics.promptTokens,
      completion_tokens: metrics.completionTokens,
      usd_cost: metrics.cost,
      tool_calls: metrics.toolCalls,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    };

    // Insert the prompt run record
    const { error: promptRunError } = await supabase
      .from('prompt_runs')
      .insert(promptRunData);

    if (promptRunError) {
      console.error('Error logging prompt run:', promptRunError);
    } else {
      console.log('Successfully logged conversation observability data');
    }

    // Log tool usage if any tools were called
    if (toolCalls && toolCalls.length > 0) {
      console.log(`Logged conversation with ${toolCalls.length} tool calls, ${metrics.totalTokens} tokens, cost: $${metrics.cost?.toFixed(4) || '0.0000'}`);
    } else {
      console.log(`Logged conversation with ${metrics.totalTokens} tokens, cost: $${metrics.cost?.toFixed(4) || '0.0000'}`);
    }

  } catch (error) {
    console.error('Error in logObservability:', error);
    // Don't throw here to avoid breaking the main conversation flow
  }
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
    'gpt-5-2025-08-07': { prompt: 0.00003, completion: 0.00006 },
    'gpt-5-mini-2025-08-07': { prompt: 0.00001, completion: 0.00003 },
    'gpt-5-nano-2025-08-07': { prompt: 0.000005, completion: 0.000015 },
    'gpt-4o': { prompt: 0.000005, completion: 0.000015 },
    'gpt-4o-mini': { prompt: 0.000001, completion: 0.000005 }
  };
  
  const rate = rates[model] || rates['gpt-5-2025-08-07'];
  return (tokens.prompt * rate.prompt) + (tokens.completion * rate.completion);
}
