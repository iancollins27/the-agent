
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getProjectContacts, formatContactsForContext } from "../../database/contacts.ts";

/**
 * Prepare context data for the workflow prompt
 * 
 * @param supabase Supabase client
 * @param projectId Project ID
 * @returns Context data object
 */
export async function prepareContextData(
  supabase: SupabaseClient,
  projectId: string
) {
  try {
    console.log(`[DEBUG] ContextUtils: Preparing context data for project: ${projectId}`);
    
    // Fetch project data first
    console.log(`[DEBUG] ContextUtils: Fetching project data from database`);
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        crm_id,
        summary,
        next_step,
        company_id,
        project_track,
        Address,
        companies(name),
        project_tracks(name, "track base prompt", Roles)
      `)
      .eq('id', projectId)
      .single();
    
    if (projectError) {
      console.error("[DEBUG] ContextUtils: Error fetching project:", projectError);
      throw projectError;
    }
    
    if (!projectData) {
      console.error("[DEBUG] ContextUtils: No project data found for ID:", projectId);
      throw new Error("Project not found");
    }
    
    // Fetch project contacts with improved logging
    console.log(`[DEBUG] ContextUtils: Starting getProjectContacts for project ${projectId}`);
    const contacts = await getProjectContacts(supabase, projectId);
    console.log(`[DEBUG] ContextUtils: Retrieved ${contacts?.length || 0} contacts`);
    
    if (contacts && contacts.length > 0) {
      console.log(`[DEBUG] ContextUtils: First contact: ${JSON.stringify(contacts[0])}`);
    } else {
      console.log(`[DEBUG] ContextUtils: No contacts returned by getProjectContacts`);
    }
    
    const formattedContacts = formatContactsForContext(contacts);
    console.log(`[DEBUG] ContextUtils: formatContactsForContext result: ${formattedContacts ? 'Success' : 'Empty or failed'}`);
    
    if (formattedContacts && formattedContacts !== "No contacts available for this project.") {
      console.log(`[DEBUG] ContextUtils: Formatted contacts first 100 chars: ${formattedContacts.substring(0, 100)}...`);
    } else {
      console.log(`[DEBUG] ContextUtils: No formatted contacts available or default message returned`);
    }
    
    // Get milestone instructions if this is a next step
    let milestoneInstructions = "No specific milestone instructions available.";
    if (projectData.next_step && projectData.project_track) {
      console.log(`[DEBUG] ContextUtils: Fetching milestone instructions for step "${projectData.next_step}" with track_id: ${projectData.project_track}`);
      
      const { data: milestoneData, error: milestoneError } = await supabase
        .from('project_track_milestones')
        .select('prompt_instructions')
        .eq('track_id', projectData.project_track)
        .eq('step_title', projectData.next_step)
        .maybeSingle();
        
      if (milestoneError) {
        console.error(`[DEBUG] ContextUtils: Error fetching milestone instructions:`, milestoneError);
      } else if (milestoneData && milestoneData.prompt_instructions) {
        milestoneInstructions = milestoneData.prompt_instructions;
        console.log(`[DEBUG] ContextUtils: Found milestone instructions (${milestoneInstructions.length} chars): ${milestoneInstructions.substring(0, 100)}...`);
      } else {
        console.log(`[DEBUG] ContextUtils: No milestone instructions found for step "${projectData.next_step}" with track_id: ${projectData.project_track}`);
      }
    } else {
      console.log(`[DEBUG] ContextUtils: Missing next_step (${projectData.next_step}) or project_track (${projectData.project_track}) for milestone lookup`);
    }
    
    // Prepare context data
    const contextData = {
      summary: projectData.summary || '',
      next_step: projectData.next_step || '',
      company_name: projectData.companies?.name || 'Unknown Company',
      track_name: projectData.project_tracks?.name || 'Default Track',
      track_base_prompt: projectData.project_tracks?.["track base prompt"] || '',
      track_roles: projectData.project_tracks?.Roles || '',
      current_date: new Date().toISOString().split('T')[0],
      milestone_instructions: milestoneInstructions,
      property_address: projectData.Address || '',
      project_id: projectId,
      contacts: contacts,
      track_id: projectData.project_track || null,
      formattedContacts: formattedContacts,
      project_contacts: formattedContacts || 'No contacts available for this project.' 
    };
    
    console.log(`[DEBUG] ContextUtils: Final contextData.project_contacts exists: ${!!contextData.project_contacts}`);
    console.log(`[DEBUG] ContextUtils: Final contextData keys: ${Object.keys(contextData).join(', ')}`);
    
    return { projectData, contextData };
  } catch (error) {
    console.error("[DEBUG] ContextUtils: Error preparing context data:", error);
    throw error;
  }
}
