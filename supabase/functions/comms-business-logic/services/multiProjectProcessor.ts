
import { updateProjectWithSpecificInfo } from "./projectUpdater.ts";

/**
 * Process a communication that might reference multiple projects
 * @param supabase Supabase client
 * @param communication Communication object
 */
export async function processMultiProjectCommunication(supabase: any, communication: any): Promise<void> {
  console.log(`Processing multi-project communication ${communication.id}`);
  
  try {
    // Get all active projects to check against
    const { data: allProjects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        summary,
        Address,
        crm_id,
        next_step,
        company_id,
        project_track,
        project_tracks(name, description, Roles, "track base prompt")
      `)
      .is('next_check_date', null) // Only consider active projects
      .order('created_at', { ascending: false })
      .limit(100); // Reasonable limit to check against
      
    if (projectsError) {
      console.error('Error fetching projects for multi-project analysis:', projectsError);
      return;
    }
    
    if (!allProjects || allProjects.length === 0) {
      console.log('No active projects found for multi-project analysis');
      return;
    }
    
    // Convert the communication into context for the AI
    const commContent = communication.content || 
      (communication.recording_url ? `[Recording available at: ${communication.recording_url}]` : 'No content available');
    
    const contextData = {
      communication_type: communication.type,
      communication_subtype: communication.subtype,
      communication_direction: communication.direction,
      communication_content: commContent,
      communication_participants: communication.participants,
      communication_timestamp: communication.timestamp,
      communication_duration: communication.duration,
      projects_data: allProjects.map(p => ({
        id: p.id,
        summary: p.summary || '',
        address: p.Address || '',
        next_step: p.next_step || '',
      })),
      multi_project_analysis: true
    };
    
    // Get latest workflow prompt for multi-project analysis
    const { data: multiProjectPrompt, error: promptError } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', 'multi_project_analysis')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (promptError && promptError.code !== 'PGRST116') {
      console.error('Error fetching multi-project analysis prompt:', promptError);
      
      // Fall back to summary_update prompt
      const { data: fallbackPrompt, error: fallbackError } = await supabase
        .from('workflow_prompts')
        .select('*')
        .eq('type', 'summary_update')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (fallbackError) {
        console.error('Error fetching fallback prompt:', fallbackError);
        return;
      }
      
      contextData.multi_project_analysis_instruction = `
        IMPORTANT: This communication appears to be between a project manager and a roofer/contractor.
        It may contain information about multiple projects. Please analyze the content and determine
        which information is relevant to THIS specific project. Only include information that is directly
        relevant to the current project in your summary update.
      `;
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
    
    // If we have a dedicated multi-project analysis prompt, use it
    if (multiProjectPrompt) {
      console.log('Using dedicated multi-project analysis prompt');
      
      // Call the AI to analyze multiple projects
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        'test-workflow-prompt',
        {
          body: {
            promptType: 'multi_project_analysis',
            promptText: multiProjectPrompt.prompt_text,
            projectId: null, // No specific project
            contextData: contextData,
            aiProvider: aiProvider,
            aiModel: aiModel,
            workflowPromptId: multiProjectPrompt.id,
            initiatedBy: 'communications-webhook',
            isMultiProjectTest: true
          }
        }
      );
      
      if (analysisError) {
        console.error('Error calling multi-project analysis:', analysisError);
        return;
      }
      
      // Parse results to get project-specific information
      try {
        const parsedResult = JSON.parse(analysisResult.output);
        
        if (!parsedResult.projects || !Array.isArray(parsedResult.projects)) {
          console.error('Invalid analysis result format:', analysisResult.output);
          return;
        }
        
        // Process each project update
        for (const projectUpdate of parsedResult.projects) {
          if (!projectUpdate.projectId || !projectUpdate.relevantContent) {
            continue;
          }
          
          // Update each relevant project with its specific info
          await updateProjectWithSpecificInfo(
            supabase, 
            projectUpdate.projectId, 
            projectUpdate.relevantContent,
            communication,
            aiProvider,
            aiModel
          );
        }
        
        console.log(`Successfully processed updates for ${parsedResult.projects.length} projects`);
      } catch (parseError) {
        console.error('Error parsing multi-project analysis result:', parseError);
      }
    } else {
      // Fallback: Process updates for each project individually
      console.log('No multi-project analysis prompt found, processing projects individually');
      
      for (const project of allProjects) {
        await updateProjectWithAI(supabase, project.id, {
          ...contextData,
          multi_project_analysis_instruction: `
            IMPORTANT: This communication appears to be between a project manager and a roofer/contractor.
            It may contain information about multiple projects. Please analyze the content and determine
            which information is relevant to THIS specific project (ID: ${project.id}, Address: ${project.Address || 'Unknown'}).
            Only include information that is directly relevant to the current project in your summary update.
          `
        });
      }
    }
  } catch (error) {
    console.error('Error in processMultiProjectCommunication:', error);
  }
}

/**
 * Process all messages in a batch for multiple projects
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param batchId Batch ID
 */
export async function processMultiProjectMessages(supabase: any, projectId: string, batchId: string): Promise<void> {
  console.log(`Processing multi-project batch for batch ${batchId}`);
  
  try {
    // Get all messages in this batch
    const { data: batchMessages, error: batchError } = await supabase
      .from('communications')
      .select('*')
      .eq('batch_id', batchId)
      .order('timestamp', { ascending: true });
      
    if (batchError) {
      console.error('Error fetching batch messages:', batchError);
      return;
    }
    
    if (!batchMessages || batchMessages.length === 0) {
      console.log('No batched messages found to process');
      return;
    }
    
    // Mark batch as processing
    const { error: updateError } = await supabase
      .from('comms_batch_status')
      .update({ batch_status: 'processing' })
      .eq('id', batchId);
      
    if (updateError) {
      console.error(`Error updating batch ${batchId} status:`, updateError);
    }
    
    // Combine the messages
    const combinedContent = batchMessages.map(msg => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.direction}: ${msg.content}`
    ).join('\n\n');
    
    // Create a synthetic communication object to represent the batch
    const batchCommunication = {
      id: batchId,
      type: 'SMS',
      subtype: 'batch',
      direction: 'mixed',
      content: combinedContent,
      participants: batchMessages[0].participants,
      timestamp: new Date().toISOString(),
      duration: null,
      batch_id: batchId
    };
    
    // Use the multi-project processing function
    await processMultiProjectCommunication(supabase, batchCommunication);
    
    // Mark batch as completed
    const { error: completeError } = await supabase
      .from('comms_batch_status')
      .update({ 
        batch_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', batchId);
      
    if (completeError) {
      console.error(`Error marking batch ${batchId} as completed:`, completeError);
    }
    
    console.log(`Successfully processed multi-project batch ${batchId}`);
  } catch (error) {
    console.error('Error in processMultiProjectMessages:', error);
  }
}
