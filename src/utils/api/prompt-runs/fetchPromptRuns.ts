
import { supabase } from "@/integrations/supabase/client";
import { PromptRunWithRoofer } from './types';

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
