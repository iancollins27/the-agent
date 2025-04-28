
import { formatCommunicationData } from "../utils/communicationFormatter.ts";
import { getAIConfiguration } from "./aiService.ts";
import { getLatestWorkflowPrompt } from "./workflowPromptService.ts";

/**
 * Update project with AI using the provided context data
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param contextData Context data for AI processing
 */
export async function updateProjectWithAI(supabase: any, projectId: string, contextData: any): Promise<void> {
  try {
    // Log the context data to help with debugging
    console.log(`Updating project ${projectId} with new communication data:`, {
      type: contextData.communication_type,
      subtype: contextData.communication_subtype,
      direction: contextData.communication_direction,
      timestamp: contextData.communication_timestamp,
      content_length: (contextData.communication_content || '').length,
      is_call: contextData.communication_type === 'CALL',
      has_recording: !!contextData.communication_recording_url
    });
    
    // Prepare the data for AI processing
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id, 
        summary, 
        next_step, 
        project_track,
        Address,
        project_tracks(name, Roles, "track base prompt")
      `)
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error('Error fetching project:', projectError);
      return;
    }
    
    // Get latest workflow prompt for summary_update
    const summaryPrompt = await getLatestWorkflowPrompt(supabase, 'summary_update');
    if (!summaryPrompt) {
      console.error('Failed to retrieve summary workflow prompt');
      return;
    }
    
    // Get AI configuration
    const { provider: aiProvider, model: aiModel } = await getAIConfiguration(supabase);
    
    // Format the communication data into a string for better readability in prompts
    const formattedCommunicationData = formatCommunicationData(contextData);
    
    // Call the AI to update the summary
    console.log('Calling test-workflow-prompt for summary update');
    const summaryContext = {
      summary: project.summary || '',
      track_name: project.project_tracks?.name || 'Default Track',
      current_date: new Date().toISOString().split('T')[0],
      new_data: formattedCommunicationData
    };
    
    // Log the actual inputs to the prompt
    console.log('Summary update context data:', {
      summary_length: (summaryContext.summary || '').length > 50 
        ? `${summaryContext.summary.substring(0, 50)}...` 
        : summaryContext.summary,
      track_name: summaryContext.track_name,
      current_date: summaryContext.current_date,
      communication_type: contextData.communication_type,
      prompt_id: summaryPrompt.id
    });
    
    const { data: summaryResult, error: summaryWorkflowError } = await supabase.functions.invoke(
      'test-workflow-prompt',
      {
        body: {
          promptType: 'summary_update',
          promptText: summaryPrompt.prompt_text,
          projectId: projectId,
          contextData: summaryContext,
          aiProvider: aiProvider,
          aiModel: aiModel,
          workflowPromptId: summaryPrompt.id,
          initiatedBy: 'communications-webhook'
        }
      }
    );
    
    if (summaryWorkflowError) {
      console.error('Error calling summary workflow prompt:', summaryWorkflowError);
      return;
    }
    
    console.log('Project summary updated successfully');
    
    // Now run action detection and execution
    const actionPrompt = await getLatestWorkflowPrompt(supabase, 'action_detection_execution');
    if (!actionPrompt) {
      console.error('Failed to retrieve action workflow prompt');
      return;
    }
    
    // Get updated project data with the new summary
    const { data: updatedProject, error: updatedProjectError } = await supabase
      .from('projects')
      .select(`
        id, 
        summary, 
        next_step, 
        project_track,
        Address,
        project_tracks(name, Roles, "track base prompt")
      `)
      .eq('id', projectId)
      .single();
      
    if (updatedProjectError) {
      console.error('Error fetching updated project:', updatedProjectError);
      return;
    }
    
    // Call the AI to detect and execute actions
    console.log('Calling test-workflow-prompt for action detection and execution');
    const actionContext = {
      summary: updatedProject.summary || '',
      track_name: updatedProject.project_tracks?.name || 'Default Track',
      track_roles: updatedProject.project_tracks?.Roles || '',
      track_base_prompt: updatedProject.project_tracks?.["track base prompt"] || '',
      current_date: new Date().toISOString().split('T')[0],
      next_step: updatedProject.next_step || '',
      new_data: formattedCommunicationData,
      is_reminder_check: false,
      property_address: updatedProject.Address || ''
    };
    
    const { data: actionResult, error: actionWorkflowError } = await supabase.functions.invoke(
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
          initiatedBy: 'communications-webhook'
        }
      }
    );
    
    if (actionWorkflowError) {
      console.error('Error calling action workflow prompt:', actionWorkflowError);
      return;
    }
    
    console.log('Project action detection and execution completed successfully');
  } catch (error) {
    console.error('Error updating project with AI:', error);
  }
}
