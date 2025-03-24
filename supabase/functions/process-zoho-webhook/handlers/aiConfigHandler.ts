
/**
 * Get AI configuration from the database
 * @param supabase Supabase client
 * @returns Object containing AI provider, model, and API key
 */
export async function getAIConfig(supabase: any) {
  const { data: aiConfig, error: aiConfigError } = await supabase
    .from('ai_config')
    .select('provider, model')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const aiProvider = aiConfig?.provider || 'openai';
  const aiModel = aiConfig?.model || 'gpt-4o';
  
  // Determine which API key to use based on the provider
  let apiKey;
  if (aiProvider === 'openai') {
    apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  } else if (aiProvider === 'claude') {
    apiKey = Deno.env.get('CLAUDE_API_KEY') ?? '';
  } else if (aiProvider === 'deepseek') {
    apiKey = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
  }

  if (!apiKey) {
    throw new Error(`API key for ${aiProvider} is not configured`);
  }
  
  return { aiProvider, aiModel, apiKey };
}
