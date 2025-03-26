
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { parseZohoData } from '../parser.ts'
import { 
  handleCompany, 
  getExistingProject, 
  getMilestoneInstructions,
  getWorkflowPrompt,
  updateProject,
  createProject,
  createMilestoneActionRecord,
  findProfileByCrmId
} from '../database.ts'
import { generateSummary } from '../ai.ts'
import { corsHeaders } from '../utils/cors.ts'
import { getAIConfig } from './aiConfigHandler.ts'

/**
 * Main handler for processing the Zoho webhook
 * @param req Request object
 * @returns Response object
 */
export async function handleZohoWebhook(req: Request) {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Log the raw request body for debugging
    const requestBody = await req.json()
    console.log('Raw webhook payload:', requestBody)
    
    // Handle both cases where data might be nested or not
    const rawData = requestBody.rawData || requestBody
    const projectData = await parseZohoData(rawData)
    console.log('Parsed project data:', projectData)

    // Handle company creation/verification and get the Supabase UUID and default track
    const companyInfo = await handleCompany(supabase, projectData, rawData)
    const companyUuid = companyInfo.id
    const defaultTrackId = companyInfo.defaultTrackId
    
    console.log('Using company UUID:', companyUuid, 'Default track ID:', defaultTrackId)
    
    // Get existing project if any
    const existingProject = await getExistingProject(supabase, projectData.crmId)

    // Determine which project track to use
    const projectTrackId = existingProject?.project_track || defaultTrackId || null
    console.log('Using project track ID:', projectTrackId)

    // Get milestone instructions if next step exists
    const nextStepInstructions = await getMilestoneInstructions(
      supabase,
      projectData.nextStep,
      projectTrackId
    )
    
    // Get track roles and base prompt if the project track exists
    const { trackRoles, trackBasePrompt, trackName } = await getTrackDetails(supabase, projectTrackId)

    // Get and format the workflow prompt
    const promptTemplate = await getWorkflowPrompt(supabase, !!existingProject)
    const prompt = formatWorkflowPrompt(
      promptTemplate, 
      existingProject?.summary || '',
      projectData,
      nextStepInstructions || '',
      trackRoles,
      trackBasePrompt,
      trackName
    )

    // Get AI configuration
    const { aiProvider, aiModel, apiKey } = await getAIConfig(supabase)
    
    console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`)

    // Generate summary using the configured AI provider
    const summary = await generateSummary(prompt, apiKey, aiProvider, aiModel)

    // Find the project manager profile using the CRM ID
    let projectManagerId = null;
    if (projectData.projectManagerId) {
      projectManagerId = await findProfileByCrmId(supabase, projectData.projectManagerId);
      console.log('Project manager profile ID:', projectManagerId);
    }

    // Prepare project data using the company UUID from Supabase
    console.log('Address being saved to project:', projectData.propertyAddress);
    
    const projectUpdateData = {
      summary,
      next_step: projectData.nextStep,
      last_action_check: new Date().toISOString(),
      company_id: companyUuid,
      project_track: projectTrackId,
      Address: projectData.propertyAddress,
      project_manager: projectManagerId
    }

    console.log('Project update data:', projectUpdateData);

    // Update or create project
    let projectId;
    if (existingProject) {
      await updateProject(supabase, existingProject.id, projectUpdateData)
      projectId = existingProject.id;
    } else {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          ...projectUpdateData,
          crm_id: projectData.crmId
        })
        .select('id')
        .single();
        
      if (error) {
        throw new Error(`Failed to create project: ${error.message}`);
      }
      
      projectId = newProject.id;
      console.log(`Created new project with ID: ${projectId}`);
    }

    // Log milestone updates for tracking purposes only
    try {
      await createMilestoneActionRecord(supabase, projectId, projectData.timeline)
    } catch (error) {
      console.error('Error creating milestone tracking records, but continuing:', error);
      // We continue processing even if action records fail
    }

    // Now run action detection and execution explicitly
    console.log('Running action detection and execution prompt...');
    try {
      const actionPrompt = await getLatestActionPrompt(supabase);
      
      if (!actionPrompt || !actionPrompt.prompt_text) {
        console.error('No action detection prompt found in the database');
      } else {
        // Format the context for the action prompt
        const actionContext = {
          summary: summary,
          track_name: trackName || 'Default Track',
          track_roles: trackRoles || '',
          track_base_prompt: trackBasePrompt || '',
          current_date: new Date().toISOString().split('T')[0],
          next_step: projectData.nextStep || '',
          new_data: JSON.stringify(projectData),
          is_reminder_check: false
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
        } else {
          console.log('Action detection workflow completed successfully:', 
            actionResult?.actionRecordId ? `Created action record: ${actionResult.actionRecordId}` : 'No action needed');
        }
      }
    } catch (actionError) {
      console.error('Error in action detection process:', actionError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary, 
        isNewProject: !existingProject,
        parsedData: projectData,
        nextStepInstructions,
        companyUuid,
        projectTrackId,
        aiProvider,
        aiModel,
        projectId,
        projectManagerId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
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

/**
 * Get track details from the project track ID
 * @param supabase Supabase client
 * @param projectTrackId Project track ID
 * @returns Object containing track roles, base prompt, and name
 */
async function getTrackDetails(supabase: any, projectTrackId: string | null) {
  let trackRoles = '';
  let trackBasePrompt = '';
  let trackName = '';
  
  if (projectTrackId) {
    const { data: trackData, error: trackError } = await supabase
      .from('project_tracks')
      .select('Roles, "track base prompt", name')
      .eq('id', projectTrackId)
      .single();
      
    if (!trackError && trackData) {
      trackRoles = trackData.Roles || '';
      trackBasePrompt = trackData['track base prompt'] || '';
      trackName = trackData.name || '';
    }
  }
  
  return { trackRoles, trackBasePrompt, trackName };
}

/**
 * Format the workflow prompt with project data
 * @param promptTemplate Prompt template from the database
 * @param existingSummary Existing project summary if available
 * @param projectData Parsed project data
 * @param nextStepInstructions Instructions for the next milestone
 * @param trackRoles Track roles
 * @param trackBasePrompt Track base prompt
 * @param trackName Track name
 * @returns Formatted prompt
 */
function formatWorkflowPrompt(
  promptTemplate: string, 
  existingSummary: string,
  projectData: any,
  nextStepInstructions: string,
  trackRoles: string,
  trackBasePrompt: string,
  trackName: string
) {
  return promptTemplate
    .replace('{{summary}}', existingSummary)
    .replace('{{new_data}}', JSON.stringify(projectData))
    .replace('{{current_date}}', new Date().toISOString().split('T')[0])
    .replace('{{next_step_instructions}}', nextStepInstructions)
    .replace('{{track_roles}}', trackRoles || '')
    .replace('{{track_base_prompt}}', trackBasePrompt || '')
    .replace('{{track_name}}', trackName || '');
}
