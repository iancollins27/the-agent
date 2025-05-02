
/**
 * Database operations for workflow prompts
 */

export async function getLatestWorkflowPrompt(supabase: any, type: string): Promise<any> {
  try {
    const { data: prompt, error } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error && error.code !== 'PGRST116') {  // PGRST116 is "no rows returned" which is fine
      console.error(`Error fetching ${type} workflow prompt:`, error);
      return null;
    }
    
    console.log(`Retrieved ${type} prompt:`, prompt ? "YES" : "NO");
    return prompt;
  } catch (error) {
    console.error(`Error in getLatestWorkflowPrompt for ${type}:`, error);
    return null;
  }
}
