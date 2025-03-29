import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export async function determineCompanyId(
  supabase: SupabaseClient,
  companyId?: string,
  projectId?: string
): Promise<string | undefined> {
  // If company ID is directly provided, use it
  if (companyId) {
    return companyId;
  }
  
  // Otherwise, try to get it from the project
  if (projectId) {
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('company_id')
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error(`Error fetching project: ${projectError.message}`);
    } else if (projectData?.company_id) {
      console.log(`Determined company ID from project: ${projectData.company_id}`);
      return projectData.company_id;
    }
  }
  
  return undefined;
}
