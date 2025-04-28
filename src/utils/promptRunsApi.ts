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
      project_roofer_contact: run.roofer_contact || null, // Including the roofer contact
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

// Fetch projects based on filters
export const fetchProjects = async (
  companyId: string, 
  userId: string | null, 
  onlyMyProjects: boolean,
  projectManagerFilter: string | null
) => {
  let projectQuery = supabase
    .from('projects')
    .select('id, crm_id, Address, project_manager, next_step') // Added next_step to the selection
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

// Define a type for our database result with the additional roofer_contact property
interface PromptRunWithRoofer extends Record<string, any> {
  roofer_contact?: string | null;
}

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
  
  // Create an array of our extended type
  const promptRunsWithRoofer: PromptRunWithRoofer[] = data || [];
  
  // Fetch roofer contact information for each project
  if (promptRunsWithRoofer.length > 0) {
    const projectIds = promptRunsWithRoofer.map(run => run.project_id).filter(Boolean);
    const uniqueProjectIds = [...new Set(projectIds)];
    
    if (uniqueProjectIds.length > 0) {
      const { data: contactsData, error: contactsError } = await supabase
        .from('project_contacts')
        .select(`
          project_id,
          contacts:contact_id (
            id, full_name, role
          )
        `)
        .in('project_id', uniqueProjectIds);
      
      if (!contactsError && contactsData) {
        // Create a map of project_id to roofer contact name
        const rooferContactMap = new Map();
        
        contactsData.forEach(item => {
          if (item.contacts && item.contacts.role === 'Roofer') {
            rooferContactMap.set(item.project_id, item.contacts.full_name);
          }
        });
        
        // Add roofer contact to each prompt run
        promptRunsWithRoofer.forEach(run => {
          if (run.project_id && rooferContactMap.has(run.project_id)) {
            // Add the property to each run object
            run.roofer_contact = rooferContactMap.get(run.project_id);
          }
        });
      } else {
        console.error("Error fetching roofer contacts:", contactsError);
      }
    }
  }
  
  return promptRunsWithRoofer;
};

/**
 * Re-runs a specific prompt run with the same configuration but using the latest AI model
 * 
 * @param promptRunId - The ID of the prompt run to re-execute
 * @returns An object with the new promptRunId if successful or an error message
 */
export const rerunPrompt = async (promptRunId: string): Promise<{ success: boolean; newPromptRunId?: string; error?: string }> => {
  try {
    // Step 1: Fetch the original prompt run details
    const { data: originalRun, error: fetchError } = await supabase
      .from('prompt_runs')
      .select(`
        id,
        prompt_input,
        project_id,
        workflow_prompt_id,
        workflow_prompts:workflow_prompt_id (type)
      `)
      .eq('id', promptRunId)
      .single();

    if (fetchError || !originalRun) {
      console.error("Error fetching original prompt run:", fetchError);
      return { 
        success: false, 
        error: `Could not find the original prompt run: ${fetchError?.message || "Not found"}` 
      };
    }

    // Step 2: Get the latest AI configuration from company settings
    const { data: aiConfig, error: configError } = await supabase
      .from('company_settings')
      .select('default_ai_provider, default_ai_model')
      .eq('setting_type', 'ai_provider')
      .single();

    if (configError) {
      console.warn("Could not fetch AI configuration, using default values:", configError);
    }

    // Step 3: Call the test-workflow-prompt edge function with the original parameters
    const promptType = originalRun.workflow_prompts?.type || 'unknown';
    
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/test-workflow-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.supabaseKey}`
      },
      body: JSON.stringify({
        promptType: promptType,
        promptText: originalRun.prompt_input,
        projectId: originalRun.project_id,
        workflowPromptId: originalRun.workflow_prompt_id,
        aiProvider: aiConfig?.default_ai_provider || 'openai',
        aiModel: aiConfig?.default_ai_model || 'gpt-4o',
        useMCP: false,
        initiatedBy: 're-run button',
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error calling test-workflow-prompt: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.promptRunId) {
      return { 
        success: false, 
        error: "Re-run completed but no new prompt run ID was returned" 
      };
    }

    return {
      success: true,
      newPromptRunId: result.promptRunId
    };

  } catch (error) {
    console.error("Error re-running prompt:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
};
