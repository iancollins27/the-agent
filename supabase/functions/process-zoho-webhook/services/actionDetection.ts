
/**
 * Action Detection Service
 * Detects and processes actions from AI responses
 */

/**
 * Detects and processes actions from AI responses
 * @param supabase Supabase client
 * @param projectId The project ID
 * @param summary The project summary
 * @param businessLogicData The data from the business logic processing
 * @param parsedProjectData The parsed project data
 * @returns The results of action detection
 */
export async function detectAndProcessActions(
  supabase: any,
  projectId: string,
  summary: string,
  businessLogicData: {
    trackName?: string;
    trackRoles?: string;
    trackBasePrompt?: string;
    nextStepInstructions?: string;
    aiProvider?: string;
    aiModel?: string;
  },
  parsedProjectData: any
): Promise<{
  actionRecordId?: string;
  actionType?: string;
  actionStatus?: string;
}> {
  try {
    console.log('Running action detection for project', projectId);
    
    // Get the latest action prompt
    const actionPrompt = await getLatestActionPrompt(supabase);
    
    if (!actionPrompt || !actionPrompt.prompt_text) {
      console.error('No action detection prompt found in the database');
      return {};
    }
    
    // Format the context for the action prompt
    const actionContext = {
      summary: summary,
      track_name: businessLogicData.trackName || 'Default Track',
      track_roles: businessLogicData.trackRoles || '',
      track_base_prompt: businessLogicData.trackBasePrompt || '',
      current_date: new Date().toISOString().split('T')[0],
      next_step: parsedProjectData.nextStep || '',
      new_data: JSON.stringify(parsedProjectData),
      is_reminder_check: false,
      milestone_instructions: businessLogicData.nextStepInstructions || ''
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
          aiProvider: businessLogicData.aiProvider || 'openai',
          aiModel: businessLogicData.aiModel || 'gpt-4o',
          workflowPromptId: actionPrompt.id,
          initiatedBy: 'zoho-webhook'
        }
      }
    );
    
    if (actionError) {
      console.error('Error invoking action detection workflow:', actionError);
      return {};
    }
    
    console.log('Action detection workflow completed successfully:', 
      actionResult?.actionRecordId ? `Created action record: ${actionResult.actionRecordId}` : 'No action needed');
    
    return {
      actionRecordId: actionResult?.actionRecordId,
      actionType: actionResult?.actionType,
      actionStatus: actionResult?.status
    };
  } catch (error) {
    console.error('Error in action detection process:', error);
    return {};
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
