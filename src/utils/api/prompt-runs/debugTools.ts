
import { supabase } from "@/integrations/supabase/client";

// Function to debug and log project-related information
export const debugProjectData = async (companyId: string) => {
  try {
    console.log("Fetching prompt runs with company ID:", companyId);
    
    const { data: allProjects, error: allProjectsError } = await supabase
      .from('projects')
      .select('id, crm_id, Address, project_manager')
      .eq('company_id', companyId);
    
    if (allProjectsError) {
      console.error("Error fetching all projects:", allProjectsError);
    } else {
      console.log("All projects for company:", allProjects);
    }

    const { data: allPromptRuns, error: allPromptRunsError } = await supabase
      .from('prompt_runs')
      .select('id, project_id, status, created_at')
      .order('created_at', { ascending: false });
    
    if (allPromptRunsError) {
      console.error("Error fetching all prompt runs:", allPromptRunsError);
    } else {
      console.log("All available prompt runs:", allPromptRuns);
    }
  } catch (error) {
    console.error("Error in debug project data:", error);
  }
};
