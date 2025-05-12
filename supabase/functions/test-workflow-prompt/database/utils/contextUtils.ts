
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
    // Fetch project data first
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
      console.error("Error fetching project:", projectError);
      throw projectError;
    }
    
    if (!projectData) {
      console.error("No project data found for ID:", projectId);
      throw new Error("Project not found");
    }
    
    // Fetch project contacts
    const contacts = await getProjectContacts(supabase, projectId);
    const formattedContacts = formatContactsForContext(contacts);
    
    // Get milestone instructions if this is a next step
    let milestoneInstructions = "";
    if (projectData.next_step && projectData.project_track) {
      const { data: milestoneData } = await supabase
        .from('project_track_milestones')
        .select('prompt_instructions')
        .eq('track_id', projectData.project_track)
        .eq('step_title', projectData.next_step)
        .maybeSingle();
        
      if (milestoneData) {
        milestoneInstructions = milestoneData.prompt_instructions || '';
      }
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
      formattedContacts: formattedContacts,
      project_contacts: formattedContacts || 'No contacts available for this project.' // Ensure this variable is properly set
    };
    
    return { projectData, contextData };
  } catch (error) {
    console.error("Error preparing context data:", error);
    throw error;
  }
}
