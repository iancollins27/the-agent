
import { formatCommunicationData } from "../utils/communicationFormatter.ts";
import { getLatestWorkflowPrompt } from "./workflowPromptService.ts";
import { AI_CONFIG } from '../../_shared/aiConfig.ts';

/**
 * Update a specific project with its relevant information extracted from a multi-project communication
 * @param supabase Supabase client
 * @param projectId Project ID 
 * @param relevantContent Relevant content for this project
 * @param communication Original communication object
 * @param aiProvider AI provider
 * @param aiModel AI model
 */
export async function updateProjectWithSpecificInfo(
  supabase: any, 
  projectId: string, 
  relevantContent: string,
  communication: any,
  aiProvider?: string,
  aiModel?: string
): Promise<void> {
  try {
    // Get the project details
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
      console.error(`Error fetching project ${projectId}:`, projectError);
      return;
    }
    
    // Get latest workflow prompt for summary_update
    const summaryPrompt = await getLatestWorkflowPrompt(supabase, 'summary_update');
    if (!summaryPrompt) {
      console.error('Failed to retrieve summary workflow prompt');
      return;
    }
    
    // If AI provider and model weren't provided, use defaults
    if (!aiProvider || !aiModel) {
      aiProvider = AI_CONFIG.provider;
      aiModel = AI_CONFIG.model;
    }
    
    // Create a formatted communication object with the relevant content
    const communicationData = {
      communication_type: communication.type,
      communication_subtype: communication.subtype || 'multi_project',
      communication_direction: communication.direction,
      communication_content: relevantContent,
      communication_timestamp: communication.timestamp,
      extracted_from_multi_project: true
    };
    
    // Format the communication data for the prompt
    const formattedCommunicationData = formatCommunicationData(communicationData);
    
    // Prepare context data with the relevant content for this specific project
    const contextData = {
      summary: project.summary || '',
      track_name: project.project_tracks?.name || 'Default Track',
      track_roles: project.project_tracks?.Roles || '',
      track_base_prompt: project.project_tracks?.["track base prompt"] || '',
      current_date: new Date().toISOString().split('T')[0],
      new_data: formattedCommunicationData
    };
    
    // Call the AI to update the summary
    console.log(`Updating project ${projectId} with its relevant content`);
    const { data: summaryResult, error: summaryWorkflowError } = await supabase.functions.invoke(
      'test-workflow-prompt',
      {
        body: {
          promptType: 'summary_update',
          promptText: summaryPrompt.prompt_text,
          projectId: projectId,
          contextData: contextData,
          aiProvider: aiProvider,
          aiModel: aiModel,
          workflowPromptId: summaryPrompt.id,
          initiatedBy: 'communications-webhook'
        }
      }
    );
    
    if (summaryWorkflowError) {
      console.error(`Error updating summary for project ${projectId}:`, summaryWorkflowError);
      return;
    }
    
    console.log(`Successfully updated project ${projectId} with its relevant content`);
    
    // Now run action detection and execution as usual
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
      console.error(`Error fetching updated project ${projectId}:`, updatedProjectError);
      return;
    }
    
    // Call the AI to detect and execute actions
    console.log(`Running action detection for project ${projectId}`);
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
      console.error(`Error running action detection for project ${projectId}:`, actionWorkflowError);
      return;
    }
    
    console.log(`Successfully completed action detection for project ${projectId}`);
  } catch (error) {
    console.error(`Error in updateProjectWithSpecificInfo for project ${projectId}:`, error);
  }
}
