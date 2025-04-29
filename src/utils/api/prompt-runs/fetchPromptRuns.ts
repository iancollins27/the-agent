
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

  // Split project IDs into batches to avoid URI too long errors
  const BATCH_SIZE = 20;
  const projectBatches = [];
  const results: PromptRunWithRoofer[] = [];
  
  for (let i = 0; i < projectIds.length; i += BATCH_SIZE) {
    projectBatches.push(projectIds.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Splitting ${projectIds.length} project IDs into ${projectBatches.length} batches`);
  
  for (const batchProjects of projectBatches) {
    try {
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
        .in('project_id', batchProjects)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      if (timeConstraint) {
        query = query.gte('created_at', timeConstraint);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching batch of prompt runs:`, error);
        continue; // Continue with the next batch even if this one fails
      }

      if (data && data.length > 0) {
        results.push(...data);
      }
    } catch (error) {
      console.error(`Error processing batch:`, error);
    }
  }
  
  console.log(`Total prompt runs found across all batches: ${results.length}`);
  
  // Fetch roofer contact information for each project in batches
  if (results.length > 0) {
    const projectIds = results
      .map(run => run.project_id)
      .filter(Boolean) as string[];
      
    const uniqueProjectIds = [...new Set(projectIds)];
    
    if (uniqueProjectIds.length > 0) {
      // Process in batches
      const rooferContactMap = new Map();
      const projectBatches = [];
      
      for (let i = 0; i < uniqueProjectIds.length; i += BATCH_SIZE) {
        projectBatches.push(uniqueProjectIds.slice(i, i + BATCH_SIZE));
      }
      
      for (const batchProjects of projectBatches) {
        try {
          const { data: contactsData, error: contactsError } = await supabase
            .from('project_contacts')
            .select(`
              project_id,
              contacts:contact_id (
                id, full_name, role
              )
            `)
            .in('project_id', batchProjects);
          
          if (!contactsError && contactsData) {
            contactsData.forEach(item => {
              if (item.contacts && item.contacts.role === 'Roofer') {
                rooferContactMap.set(item.project_id, item.contacts.full_name);
              }
            });
          } else {
            console.error(`Error fetching batch of roofer contacts:`, contactsError);
          }
        } catch (error) {
          console.error(`Error processing contacts batch:`, error);
        }
      }
      
      // Add roofer contact to each prompt run
      results.forEach(run => {
        if (run.project_id && rooferContactMap.has(run.project_id)) {
          // Add the property to each run object
          run.roofer_contact = rooferContactMap.get(run.project_id);
        }
      });
    }
  }
  
  return results;
};
