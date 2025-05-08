
import { supabase } from "@/integrations/supabase/client";

// Define explicit interfaces to prevent deep type instantiation
interface ProjectData {
  id: string;
  crm_id?: string;
  summary?: string;
  next_step?: string;
  company_id?: string;
  project_track?: string;
  Address?: string;
  companies?: { name?: string };
  project_tracks?: { 
    name?: string; 
    "track base prompt"?: string; 
    Roles?: string 
  };
}

interface MilestoneData {
  prompt_instructions?: string;
}

interface ContextData {
  summary: string;
  next_step: string;
  company_name: string;
  track_name: string;
  track_base_prompt: string;
  track_roles: string;
  track_id: string | null;
  current_date: string;
  milestone_instructions: string;
  action_description: string;
  isMultiProjectTest: boolean;
  property_address: string;
  available_tools: string[];
  project_id: string; // This field is important for the data_fetch tool
}

/**
 * Hook for preparing context data for test runs
 */
export const useContextData = () => {
  // Prepare context data for the test run
  const prepareContextData = async (projectId: string, isMultiProjectTest: boolean, availableTools: string[]) => {
    try {
      // Fetch the project details with explicit type annotation
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
          companies!inner(name),
          project_tracks!inner(name, "track base prompt", Roles)
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
      
      // Prepare context data with explicit type annotation
      const contextData: ContextData = {
        summary: projectData.summary || '',
        next_step: projectData.next_step || '',
        company_name: projectData.companies?.name || 'Unknown Company',
        track_name: projectData.project_tracks?.name || 'Default Track',
        track_base_prompt: projectData.project_tracks?.["track base prompt"] || '',
        track_roles: projectData.project_tracks?.Roles || '',
        track_id: projectData.project_track || null,
        current_date: new Date().toISOString().split('T')[0],
        milestone_instructions: '',
        action_description: 'Sample action for testing',
        isMultiProjectTest: isMultiProjectTest,
        property_address: projectData.Address || '',
        available_tools: availableTools,
        project_id: projectId // Always include the project_id in context data
      };
      
      // Get milestone instructions if this is a next step
      if (projectData.next_step) {
        const { data: milestoneData } = await supabase
          .from('project_track_milestones')
          .select('prompt_instructions')
          .eq('track_id', projectData.project_track)
          .eq('step_title', projectData.next_step)
          .maybeSingle();
          
        if (milestoneData) {
          contextData.milestone_instructions = milestoneData.prompt_instructions || '';
        }
      }

      return { projectData: projectData as ProjectData, contextData };
    } catch (error) {
      console.error("Error preparing context data:", error);
      throw error;
    }
  };

  return { prepareContextData };
};
