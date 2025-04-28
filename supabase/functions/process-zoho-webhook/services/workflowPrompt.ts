
/**
 * Workflow Prompt Service
 * Generates LLM prompts and processes actions from the responses
 */
import { formatWorkflowPrompt } from '../utils/promptFormatters.ts';
import { ParsedProjectData } from '../types.ts';

/**
 * Generates a project summary using the workflow prompt
 * @param supabase Supabase client
 * @param projectId The project ID
 * @param projectData The parsed project data
 * @param businessLogicData The data from the business logic processing
 * @returns The generated summary and any detected actions
 */
export async function generateWorkflowPrompt(
  supabase: any,
  projectId: string,
  projectData: ParsedProjectData,
  businessLogicData: {
    summary: string;
    nextStepInstructions?: string;
    trackName?: string;
    trackRoles?: string;
    trackBasePrompt?: string;
    isNewProject: boolean;
    propertyAddress?: string; // Added property address
  }
): Promise<{
  summary: string;
  actions: any[];
}> {
  try {
    console.log(`Generating workflow prompt for project ${projectId}`);
    
    // Import what we need
    const { getWorkflowPrompt } = await import('../database.ts');
    const { generateSummary } = await import('../ai.ts');
    
    // Get the appropriate prompt template based on if it's a new or existing project
    const promptTemplate = await getWorkflowPrompt(supabase, !businessLogicData.isNewProject);
    
    // Format the prompt using our existing utility
    const prompt = formatWorkflowPrompt(
      promptTemplate, 
      businessLogicData.summary,
      projectData,
      businessLogicData.nextStepInstructions || '',
      businessLogicData.trackRoles || '',
      businessLogicData.trackBasePrompt || '',
      businessLogicData.trackName || ''
    );
    
    // For now, return an empty array of actions
    // In a full implementation, we would parse the AI response to detect actions
    return {
      summary: '', // We'll fill this after AI processing
      actions: []
    };
  } catch (error) {
    console.error('Error generating workflow prompt:', error);
    throw error;
  }
}

/**
 * Runs the workflow prompt through the AI engine and processes the results
 * @param supabase Supabase client
 * @param projectId The project ID
 * @param prompt The formatted prompt
 * @param aiProvider The AI provider to use
 * @param aiModel The AI model to use
 * @returns The generated summary and any detected actions
 */
export async function runWorkflowPrompt(
  supabase: any,
  projectId: string,
  prompt: string,
  aiProvider: string,
  aiModel: string
): Promise<{
  summary: string;
  detectedActions: any[];
}> {
  try {
    console.log(`Running workflow prompt through ${aiProvider} ${aiModel}`);
    
    // Generate summary using the configured AI provider
    const { generateSummary } = await import('../ai.ts');
    const apiKey = getApiKey(aiProvider);
    
    // Import the database functions correctly
    // This was the source of the error - we need to use the properly structured imports
    const promptRunId = await supabase
      .from('prompt_runs')
      .insert({
        project_id: projectId,
        prompt_input: prompt,
        ai_provider: aiProvider,
        ai_model: aiModel,
        status: 'PENDING'
      })
      .select()
      .single()
      .then(({ data }) => data?.id)
      .catch(error => {
        console.error("Error logging prompt run:", error);
        return null;
      });
    
    console.log(`Created prompt run with ID: ${promptRunId || "Failed to create"}`);
    
    // Generate the summary
    const summary = await generateSummary(prompt, apiKey, aiProvider, aiModel);
    
    // Update the prompt run with the result
    if (promptRunId) {
      try {
        await supabase
          .from('prompt_runs')
          .update({
            prompt_output: summary,
            status: 'COMPLETED',
            completed_at: new Date().toISOString()
          })
          .eq('id', promptRunId);
        
        console.log(`Updated prompt run ${promptRunId} with result`);
      } catch (updateError) {
        console.error("Error updating prompt run:", updateError);
      }
    }
      
    // Update the project with the new summary
    await supabase
      .from('projects')
      .update({ summary })
      .eq('id', projectId);
      
    // In a full implementation, we would parse the AI response to detect actions
    // For now, return an empty array of actions
    return {
      summary,
      detectedActions: []
    };
  } catch (error) {
    console.error('Error running workflow prompt:', error);
    throw error;
  }
}

/**
 * Gets the API key for the specified AI provider
 * @param provider The AI provider
 * @returns The API key
 */
function getApiKey(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'openai':
      return Deno.env.get('OPENAI_API_KEY') || '';
    case 'claude':
      return Deno.env.get('CLAUDE_API_KEY') || '';
    case 'deepseek':
      return Deno.env.get('DEEPSEEK_API_KEY') || '';
    default:
      throw new Error(`API key for ${provider} is not configured`);
  }
}
