
/**
 * Fetch the latest workflow prompt of a specific type
 * @param supabase Supabase client
 * @param type Workflow prompt type
 * @returns Workflow prompt object or null if not found
 */
export async function getLatestWorkflowPrompt(supabase: any, type: string): Promise<any> {
  try {
    console.log(`Fetching latest ${type} workflow prompt`);
    const { data: prompt, error } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`No ${type} workflow prompt found`);
        return null;
      }
      console.error(`Error fetching ${type} workflow prompt:`, error);
      return null;
    }
    
    console.log(`Found ${type} workflow prompt:`, prompt.id);
    return prompt;
  } catch (error) {
    console.error(`Error in getLatestWorkflowPrompt for ${type}:`, error);
    return null;
  }
}
