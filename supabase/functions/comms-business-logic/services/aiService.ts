
/**
 * Retrieves AI configuration from the database
 * @param supabase Supabase client
 * @returns The AI provider and model configuration
 */
export async function getAIConfiguration(supabase: any): Promise<{ provider: string, model: string }> {
  // Get AI configuration
  const { data: aiConfig, error: aiConfigError } = await supabase
    .from('ai_config')
    .select('provider, model')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (aiConfigError) {
    console.error('Error fetching AI configuration:', aiConfigError);
  }
  
  return {
    provider: aiConfig?.provider || 'openai',
    model: aiConfig?.model || 'gpt-4o'
  };
}
