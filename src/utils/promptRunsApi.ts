
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from '@/components/admin/types';
import { toast } from "@/components/ui/use-toast";

// Formats data from the database into the PromptRun format
export const formatPromptRunData = (data: any[]): PromptRun[] => {
  return data.map(run => {
    const baseUrl = run.projects?.companies?.company_project_base_URL || null;
    const crmId = run.projects?.crm_id || null;
    const crmUrl = baseUrl && crmId ? `${baseUrl}${crmId}` : null;
    
    return {
      ...run,
      project_name: run.projects?.crm_id || 'Unknown Project',
      project_address: run.projects?.Address || null,
      project_crm_url: crmUrl,
      project_next_step: run.projects?.next_step || null,
      project_roofer_contact: run.projects?.roofer_contact || null, // Added this property
      workflow_prompt_type: run.workflow_prompts?.type || 'Unknown Type',
      workflow_type: run.workflow_prompts?.type,
      prompt_text: run.prompt_input,
      result: run.prompt_output
    } as unknown as PromptRun;
  });
};

// Function to debug and log project-related information
export const debugProjectData = async (companyId: string) => {
  try {
    console.log("Fetching prompt runs with company ID:", companyId);
    
    const { data: allProjects, error: allProjectsError } = await supabase
      .from('projects')
      .select('id, crm_id, Address, project_manager, roofer_contact') // Added roofer_contact
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

// Fetch projects based on filters
export const fetchProjects = async (
  companyId: string, 
  userId: string | null, 
  onlyMyProjects: boolean,
  projectManagerFilter: string | null
) => {
  let projectQuery = supabase
    .from('projects')
    .select('id, crm_id, Address, project_manager, next_step, roofer_contact') // Added roofer_contact
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

// Fetch prompt runs with filters
export const fetchFilteredPromptRuns = async (
  projectIds: string[],
  statusFilter: string | null,
  timeConstraint: string | null
) => {
  if (projectIds.length === 0) {
    return [];
  }

  let query = supabase
    .from('prompt_runs')
    .select(`
      *,
      projects:project_id (
        id,
        crm_id, 
        Address,
        company_id,
        project_manager,
        next_step,
        roofer_contact,
        companies:company_id (
          company_project_base_URL
        )
      ),
      workflow_prompts:workflow_prompt_id (type)
    `)
    .in('project_id', projectIds)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  if (timeConstraint) {
    query = query.gte('created_at', timeConstraint);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  console.log("Prompt runs found:", data?.length || 0);
  return data;
};
