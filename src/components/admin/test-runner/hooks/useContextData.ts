
import { supabase } from "@/integrations/supabase/client";

export const useContextData = () => {
  /**
   * Prepares context data for a project, including track-related information
   */
  const prepareContextData = async (
    projectId: string,
    isMultiProjectTest: boolean = false,
    availableTools: string[] = []
  ) => {
    try {
      // Fetch project data
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          companies (
            name
          ),
          project_tracks (
            id, 
            name,
            description,
            Roles,
            base_prompt
          )
        `)
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Fetch contacts for the project
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('project_id', projectId);

      if (contactsError) throw contactsError;
      
      // Create context data object
      const contextData = {
        project_id: projectId,
        summary: projectData.summary,
        next_step: projectData.next_step,
        property_address: projectData.Address,
        track_id: projectData.project_track,
        track_name: projectData.project_tracks?.name,
        track_roles: projectData.project_tracks?.Roles,
        track_base_prompt: projectData.project_tracks?.base_prompt,
        current_date: new Date().toISOString().split('T')[0],
        is_reminder_check: false,
        company_name: projectData.companies?.name,
        contacts: contacts,
        available_tools: availableTools
      };

      return {
        projectData,
        contextData
      };
    } catch (error) {
      console.error("Error preparing context data:", error);
      throw error;
    }
  };

  return {
    prepareContextData
  };
};
