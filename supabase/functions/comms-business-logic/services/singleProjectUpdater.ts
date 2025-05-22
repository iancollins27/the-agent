
import { formatCommunicationData } from "../utils/communicationFormatter.ts";

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
    
    // Format the communication data into a string for better readability in prompts
    const formattedCommunicationData = formatCommunicationData(contextData);
    
    // Using agent-chat instead of test-workflow-prompt
    console.log('Calling agent-chat to process communication');
    
    // Prepare system prompt that includes project context
    const systemPrompt = `You are an AI assistant helping with project ${projectId}. 
This is a ${project.project_tracks?.name || 'Default Track'} project.
Current summary: ${project.summary || 'No summary available'}
Next step: ${project.next_step || 'No next step defined'}
Address: ${project.Address || 'No address available'}

You have received a new communication. Please analyze it and update the project accordingly.`;

    // Prepare the user message with the new communication data
    const userMessage = `New communication: ${formattedCommunicationData}

Please analyze this communication and:
1. Update the project summary with any new relevant information
2. Determine appropriate next steps
3. Take any actions needed based on this communication`;

    // Call agent-chat with messages format
    const { data: agentChatResult, error: agentChatError } = await supabase.functions.invoke(
      'agent-chat',
      {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          projectId: projectId,
          projectData: {
            id: projectId,
            summary: project.summary || '',
            next_step: project.next_step || '',
            track_name: project.project_tracks?.name || 'Default Track',
            track_roles: project.project_tracks?.Roles || '',
            track_base_prompt: project.project_tracks?.["track base prompt"] || '',
            property_address: project.Address || '',
            current_date: new Date().toISOString().split('T')[0]
          },
          availableTools: ['create-action-record', 'data-fetch', 'read-crm-data', 'identify-project']
        }
      }
    );
    
    if (agentChatError) {
      console.error('Error calling agent-chat:', agentChatError);
      return;
    }
    
    // Log the agent-chat result
    console.log('agent-chat processing complete:', {
      success: !!agentChatResult,
      response_length: agentChatResult?.choices?.[0]?.message?.content?.length || 0
    });
    
    console.log('Project updated successfully using agent-chat');
  } catch (error) {
    console.error('Error updating project with AI:', error);
  }
}
