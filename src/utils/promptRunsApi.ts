
import { supabase } from "@/integrations/supabase/client";

export const debugProjectData = async (companyId: string) => {
  try {
    // Check if the company has projects
    const { count, error } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    console.log(`Company ${companyId} has ${count} projects`);
    
    if (error) {
      console.error(`Error checking company projects: ${error.message}`);
    }
    
    return count || 0;
  } catch (e) {
    console.error("Error in debugProjectData:", e);
    return 0;
  }
};

export const fetchProjects = async (
  companyId: string, 
  userId: string, 
  onlyShowMyProjects: boolean,
  projectManagerFilter: string | null
) => {
  try {
    let query = supabase
      .from('projects')
      .select(`
        id, 
        project_manager,
        company_id,
        Address
      `)
      .eq('company_id', companyId);

    if (onlyShowMyProjects) {
      query = query.eq('project_manager', userId);
    } else if (projectManagerFilter) {
      query = query.eq('project_manager', projectManagerFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }

    return data || [];
  } catch (e) {
    console.error("Error in fetchProjects:", e);
    return [];
  }
};

export const fetchFilteredPromptRuns = async (
  projectIds: string[], 
  statusFilter: string | null,
  timeConstraint: string | null,
  from: number = 0,
  to: number = 19
) => {
  try {
    if (projectIds.length === 0) {
      return [];
    }

    let query = supabase
      .from('prompt_runs')
      .select(`
        id,
        project_id,
        created_at,
        completed_at,
        status,
        ai_provider,
        ai_model,
        workflow_prompt_id,
        prompt_input,
        prompt_output,
        error_message,
        feedback_rating,
        feedback_description,
        feedback_tags,
        reviewed,
        workflow_prompts (
          type
        ),
        projects!prompt_runs_project_id_fkey (
          Address,
          project_manager,
          profiles (
            profile_fname,
            profile_lname
          )
        )
      `)
      .in('project_id', projectIds)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (timeConstraint) {
      query = query.gte('created_at', timeConstraint);
    }

    // Add range for pagination
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching filtered prompt runs:', error);
      throw error;
    }

    return data || [];
  } catch (e) {
    console.error("Error in fetchFilteredPromptRuns:", e);
    return [];
  }
};

export const formatPromptRunData = (promptRunsData: any[]) => {
  try {
    return promptRunsData.map(run => ({
      id: run.id,
      project_id: run.project_id,
      workflow_prompt_id: run.workflow_prompt_id,
      prompt_input: run.prompt_input || '',
      prompt_output: run.prompt_output,
      error_message: run.error_message,
      status: run.status,
      created_at: run.created_at,
      completed_at: run.completed_at,
      feedback_rating: run.feedback_rating,
      feedback_description: run.feedback_description,
      feedback_tags: run.feedback_tags,
      project_address: run.projects?.Address || 'Unknown Address',
      workflow_prompt_type: run.workflow_prompts?.type || 'unknown',
      workflow_type: run.workflow_prompts?.type,
      reviewed: run.reviewed === true,
      project_manager: run.projects?.project_manager || null,
      project_roofer_contact: null,
      pm_name: run.projects?.profiles 
        ? `${run.projects.profiles.profile_fname || ''} ${run.projects.profiles.profile_lname || ''}`.trim() 
        : 'Unknown',
      pending_actions: 0
    }));
  } catch (e) {
    console.error("Error in formatPromptRunData:", e);
    return [];
  }
};
