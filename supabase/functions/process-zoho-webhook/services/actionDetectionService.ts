
/**
 * Service for handling action detection and execution
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

/**
 * Run action detection and execution workflow for a project
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param summary Project summary
 * @param trackName Track name
 * @param trackRoles Track roles
 * @param trackBasePrompt Track base prompt
 * @param nextStep Next step
 * @param projectData Project data
 * @param milestoneInstructions Milestone instructions
 * @param aiProvider AI provider
 * @param aiModel AI model
 * @param propertyAddress Property address for the project
 * @returns Result of the action detection workflow
 */
export async function runActionDetection(
  supabase: any,
  projectId: string,
  summary: string,
  trackName: string,
  trackRoles: string,
  trackBasePrompt: string,
  nextStep: string,
  projectData: any,
  milestoneInstructions: string,
  aiProvider: string,
  aiModel: string,
  propertyAddress: string = ''
) {
  try {
    console.log('Running action detection and execution prompt...');
    
    const actionPrompt = await getLatestActionPrompt(supabase);
    
    if (!actionPrompt || !actionPrompt.prompt_text) {
      console.error('No action detection prompt found in the database');
      return null;
    }
    
    // Format the context for the action prompt
    const actionContext = {
      summary: summary,
      track_name: trackName || 'Default Track',
      track_roles: trackRoles || '',
      track_base_prompt: trackBasePrompt || '',
      current_date: new Date().toISOString().split('T')[0],
      next_step: nextStep || '',
      new_data: JSON.stringify(projectData),
      is_reminder_check: false,
      milestone_instructions: milestoneInstructions || '', // Include milestone instructions
      property_address: propertyAddress || '' // Include property address
    };
    
    console.log('Calling action detection workflow with context:', Object.keys(actionContext));
    
    // Call the action detection workflow
    const { data: actionResult, error: actionError } = await supabase.functions.invoke(
      'test-workflow-prompt',
      {
        body: {
          promptType: 'action_detection_execution',
          promptText: actionPrompt.prompt_text,
          projectId: projectId,
          contextData: actionContext,
          aiProvider: aiProvider,
          aiModel: aiModel,
          workflowPromptId: actionPrompt.id,
          initiatedBy: 'zoho-webhook'
        }
      }
    );
    
    if (actionError) {
      console.error('Error invoking action detection workflow:', actionError);
      return null;
    }
    
    console.log('Action detection workflow completed successfully:', 
      actionResult?.actionRecordId ? `Created action record: ${actionResult.actionRecordId}` : 'No action needed');
    
    return actionResult;
  } catch (error) {
    console.error('Error in action detection process:', error);
    return null;
  }
}

/**
 * Get the latest action detection workflow prompt
 * @param supabase Supabase client
 * @returns The latest action detection workflow prompt
 */
async function getLatestActionPrompt(supabase: any) {
  const { data: prompt, error } = await supabase
    .from('workflow_prompts')
    .select('*')
    .eq('type', 'action_detection_execution')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching action detection prompt:', error);
    return null;
  }
  
  return prompt;
}
