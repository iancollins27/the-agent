
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
import { formatWorkflowPrompt } from '../utils/promptFormatters.ts'
import { getTrackDetails } from '../services/trackService.ts'
import { runActionDetection } from '../services/actionDetectionService.ts'

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
    console.log('Next step from projectData:', projectData.nextStep);
    
    // ENHANCED LOGGING: Check if next step is valid for milestone lookup
    if (!projectData.nextStep || projectData.nextStep.trim() === '') {
      console.warn('Next step is empty or undefined, cannot retrieve milestone instructions');
    }
    
    // ENHANCED LOGGING: Check if project track ID is valid for milestone lookup
    if (!projectTrackId) {
      console.warn('Project track ID is null, cannot retrieve milestone instructions');
    }
    
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

    // Run action detection and execution
    await runActionDetection(
      supabase, 
      projectId, 
      summary, 
      trackName, 
      trackRoles, 
      trackBasePrompt, 
      projectData.nextStep,
      projectData,
      nextStepInstructions || '',
      aiProvider,
      aiModel
    );

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
