
/**
 * Business Logic Service
 * Handles core application logic after data is normalized
 */
import { StandardizedWebhookData } from './normalizer.ts';
import { ParsedProjectData } from '../types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

/**
 * Processes business logic for the webhook
 * @param supabase Supabase client
 * @param projectData The parsed project data
 * @param standardData The standardized webhook data
 * @returns Processing results including project ID and summary
 */
export async function processWebhookBusinessLogic(
  supabase: any,
  projectData: ParsedProjectData,
  standardData: StandardizedWebhookData
): Promise<{
  projectId: string;
  companyUuid: string;
  projectTrackId: string | null;
  summary: string;
  isNewProject: boolean;
  nextStepInstructions?: string;
  trackName?: string;
  trackRoles?: string;
  trackBasePrompt?: string;
  aiProvider?: string;
  aiModel?: string;
}> {
  try {
    console.log('Processing business logic for project:', standardData.crmId);
    
    // Import the necessary functions from our existing database.ts
    const { 
      handleCompany, 
      getExistingProject, 
      getMilestoneInstructions,
      updateProject,
      createProject
    } = await import('../database.ts');
    
    // Import the track service
    const { getTrackDetails } = await import('../services/trackService.ts');
    
    // Import AI config handler
    const { getAIConfig } = await import('../handlers/aiConfigHandler.ts');
    
    // Handle company creation/verification and get the Supabase UUID
    const companyInfo = await handleCompany(supabase, projectData, standardData.rawPayload);
    const companyUuid = companyInfo.id;
    const defaultTrackId = companyInfo.defaultTrackId;
    
    console.log('Using company UUID:', companyUuid, 'Default track ID:', defaultTrackId);
    
    // Get existing project if any
    const existingProject = await getExistingProject(supabase, projectData.crmId);
    const isNewProject = !existingProject;
    
    // Determine which project track to use
    const projectTrackId = existingProject?.project_track || defaultTrackId || null;
    console.log('Using project track ID:', projectTrackId);
    
    // Get milestone instructions if next step exists
    let nextStepInstructions = '';
    if (projectTrackId && projectData.nextStep && projectData.nextStep.trim() !== '') {
      nextStepInstructions = await getMilestoneInstructions(
        supabase,
        projectData.nextStep,
        projectTrackId
      ) || '';
    }

    // Get track details if the project track exists
    const { trackRoles, trackBasePrompt, trackName } = await getTrackDetails(supabase, projectTrackId);

    // Get AI configuration
    const { aiProvider, aiModel } = await getAIConfig(supabase);
    console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);
    
    // Find the project manager profile using the CRM ID
    const { findProfileByCrmId } = await import('../database.ts');
    let projectManagerId = null;
    if (projectData.projectManagerId) {
      projectManagerId = await findProfileByCrmId(supabase, projectData.projectManagerId);
      console.log('Project manager profile ID:', projectManagerId);
    }
    
    // At this point in a real implementation, we would update project records
    // For now, let's use our existing functions but optimize later
    
    // For now, we'll return an empty summary, and let the workflow prompt service handle it
    let projectId: string;
    // Parse timeline dates for caching activation criteria fields
    const contractSigned = projectData.timeline?.contractSigned 
      ? new Date(projectData.timeline.contractSigned).toISOString() 
      : null;
    const roofInstallFinalized = projectData.timeline?.roofInstallFinalized 
      ? new Date(projectData.timeline.roofInstallFinalized).toISOString() 
      : null;
    
    // Get Test_Record and Status from raw payload
    const rawData = standardData.rawPayload?.rawData || standardData.rawPayload || {};
    const testRecord = rawData.Test_Record === true || rawData.Test_Record === 'true';
    const crmStatus = rawData.Status || null;
    
    const projectUpdateData = {
      next_step: projectData.nextStep,
      last_action_check: new Date().toISOString(),
      company_id: companyUuid,
      project_track: projectTrackId,
      Address: projectData.propertyAddress,
      project_manager: projectManagerId,
      // Cache activation criteria fields locally
      Contract_Signed: contractSigned,
      Roof_Install_Finalized: roofInstallFinalized,
      Test_Record: testRecord,
      crm_status: crmStatus
    };

    console.log('Project update data:', projectUpdateData);

    // Update or create project
    if (existingProject) {
      await updateProject(supabase, existingProject.id, projectUpdateData);
      projectId = existingProject.id;
    } else {
      // When creating a new project, track creation time
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          ...projectUpdateData,
          crm_id: projectData.crmId,
          created_at: new Date().toISOString() // Explicitly set created_at for new projects
        })
        .select('id')
        .single();
        
      if (error) {
        throw new Error(`Failed to create project: ${error.message}`);
      }
      
      projectId = newProject.id;
      console.log(`Created new project with ID: ${projectId}`);
    }
    
    // Return the data needed for the next steps
    return {
      projectId,
      companyUuid,
      projectTrackId,
      summary: existingProject?.summary || '',
      isNewProject,
      nextStepInstructions,
      trackName,
      trackRoles,
      trackBasePrompt,
      aiProvider,
      aiModel
    };
  } catch (error) {
    console.error('Error in business logic processing:', error);
    throw error;
  }
}
