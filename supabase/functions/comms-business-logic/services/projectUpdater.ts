
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
        project_tracks(name, Roles, "track base prompt")
      `)
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error('Error fetching project:', projectError);
      return;
    }
    
    // Get latest workflow prompt for summary_update
    const { data: summaryPrompt, error: summaryPromptError } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', 'summary_update')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (summaryPromptError) {
      console.error('Error fetching summary workflow prompt:', summaryPromptError);
      return;
    }
    
    // Get AI configuration
    const { data: aiConfig, error: aiConfigError } = await supabase
      .from('ai_config')
      .select('provider, model')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    const aiProvider = aiConfig?.provider || 'openai';
    const aiModel = aiConfig?.model || 'gpt-4o';
    
    // Call the AI to update the summary
    console.log('Calling test-workflow-prompt for summary update');
    const summaryContext = {
      summary: project.summary || '',
      track_name: project.project_tracks?.name || 'Default Track',
      current_date: new Date().toISOString().split('T')[0],
      new_data: contextData
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
    const { data: actionPrompt, error: actionPromptError } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', 'action_detection_execution')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (actionPromptError) {
      console.error('Error fetching action workflow prompt:', actionPromptError);
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
      new_data: contextData,
      is_reminder_check: false
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

/**
 * Update a specific project with its relevant information extracted from a multi-project communication
 */
export async function updateProjectWithSpecificInfo(
  supabase: any, 
  projectId: string, 
  relevantContent: string,
  communication: any,
  aiProvider: string,
  aiModel: string
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
        project_tracks(name, Roles, "track base prompt")
      `)
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error(`Error fetching project ${projectId}:`, projectError);
      return;
    }
    
    // Get latest workflow prompt for summary_update
    const { data: summaryPrompt, error: summaryPromptError } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', 'summary_update')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (summaryPromptError) {
      console.error('Error fetching summary workflow prompt:', summaryPromptError);
      return;
    }
    
    // Prepare context data with the relevant content for this specific project
    const contextData = {
      summary: project.summary || '',
      track_name: project.project_tracks?.name || 'Default Track',
      track_roles: project.project_tracks?.Roles || '',
      track_base_prompt: project.project_tracks?.["track base prompt"] || '',
      current_date: new Date().toISOString().split('T')[0],
      new_data: {
        communication_type: communication.type,
        communication_subtype: communication.subtype || 'multi_project',
        communication_direction: communication.direction,
        communication_content: relevantContent, // Only the relevant content for this project
        communication_timestamp: communication.timestamp,
        extracted_from_multi_project: true
      }
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
    const { data: actionPrompt, error: actionPromptError } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', 'action_detection_execution')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (actionPromptError) {
      console.error('Error fetching action workflow prompt:', actionPromptError);
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
      new_data: contextData.new_data,
      is_reminder_check: false
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
