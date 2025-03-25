
import { handleCompany, getExistingProject, updateProject, findProfileByCrmId } from '../database.ts';
import { createMilestoneActionRecord } from '../database/action.ts';
import { getTrackDetails } from './trackService.ts';
import { getMilestoneInstructions, getWorkflowPrompt } from '../database/milestone.ts';
import { formatWorkflowPrompt } from '../utils/promptFormatter.ts';
import { generateSummary } from '../ai.ts';
import { getAIConfig } from '../handlers/aiConfigHandler.ts';

/**
 * Process a project based on webhook data
 * @param supabase Supabase client
 * @param projectData Parsed project data
 * @param rawData Raw webhook data
 * @returns Processed project information
 */
export async function processProject(supabase: any, projectData: any, rawData: any) {
  // Handle company creation/verification and get the Supabase UUID and default track
  const companyInfo = await handleCompany(supabase, projectData, rawData);
  const companyUuid = companyInfo.id;
  const defaultTrackId = companyInfo.defaultTrackId;
  
  console.log('Using company UUID:', companyUuid, 'Default track ID:', defaultTrackId);
  
  // Get existing project if any
  const existingProject = await getExistingProject(supabase, projectData.crmId);

  // Determine which project track to use
  const projectTrackId = existingProject?.project_track || defaultTrackId || null;
  console.log('Using project track ID:', projectTrackId);

  // Get milestone instructions if next step exists
  const nextStepInstructions = await getMilestoneInstructions(
    supabase,
    projectData.nextStep,
    projectTrackId
  );
  
  // Get track roles and base prompt if the project track exists
  const { trackRoles, trackBasePrompt, trackName } = await getTrackDetails(supabase, projectTrackId);

  // Get and format the workflow prompt
  const promptTemplate = await getWorkflowPrompt(supabase, !!existingProject);
  const prompt = formatWorkflowPrompt(
    promptTemplate, 
    existingProject?.summary || '',
    projectData,
    nextStepInstructions || '',
    trackRoles,
    trackBasePrompt,
    trackName
  );

  // Get AI configuration
  const { aiProvider, aiModel, apiKey } = await getAIConfig(supabase);
  
  console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);

  // Generate summary using the configured AI provider
  const summary = await generateSummary(prompt, apiKey, aiProvider, aiModel);

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
  };

  console.log('Project update data:', projectUpdateData);

  // Update or create project
  let projectId;
  if (existingProject) {
    await updateProject(supabase, existingProject.id, projectUpdateData);
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

  // Log milestone updates using the action_records table
  try {
    await createMilestoneActionRecord(supabase, projectId, projectData.timeline);
  } catch (error) {
    console.error('Error creating milestone action records, but continuing:', error);
    // We continue processing even if action records fail
  }

  return {
    summary,
    isNewProject: !existingProject,
    projectId,
    companyUuid,
    projectTrackId,
    aiProvider,
    aiModel,
    projectManagerId,
    nextStepInstructions
  };
}
