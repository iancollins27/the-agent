
/**
 * Fetch the latest workflow prompt of a specific type
 * @param supabase Supabase client
 * @param type Workflow prompt type
 * @returns Workflow prompt object or null if not found
 */
export async function getLatestWorkflowPrompt(supabase: any, type: string): Promise<any> {
  const { data: prompt, error } = await supabase
    .from('workflow_prompts')
    .select('*')
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    console.error(`Error fetching ${type} workflow prompt:`, error);
    return null;
  }
  
  return prompt;
}
