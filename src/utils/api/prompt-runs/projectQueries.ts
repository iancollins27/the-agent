
import { supabase } from "@/integrations/supabase/client";

// Fetch projects based on filters
export const fetchProjects = async (
  companyId: string, 
  userId: string | null, 
  onlyMyProjects: boolean,
  projectManagerFilter: string | null
) => {
  let projectQuery = supabase
    .from('projects')
    .select('id, crm_id, Address, project_manager, next_step')
    .eq('company_id', companyId);

  if (onlyMyProjects && userId) {
    // This filter takes precedence over projectManagerFilter
    projectQuery = projectQuery.eq('project_manager', userId);
  } else if (projectManagerFilter) {
    // Only apply project manager filter if we're not filtering for current user's projects
    projectQuery = projectQuery.eq('project_manager', projectManagerFilter);
  }

  const { data, error } = await projectQuery;
  
  if (error) {
    throw error;
  }
  
  console.log("Projects found:", data?.length || 0);
  return data || [];
};
