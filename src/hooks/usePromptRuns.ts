
import { useState, useEffect } from 'react';
import { PromptRun } from '../components/admin/types';
import { usePromptFeedback } from './usePromptFeedback';
import { usePromptRunsFetcher } from './promptRuns/usePromptRunsFetcher';
import { UsePromptRunsProps } from './promptRuns/types';
import { supabase } from "@/integrations/supabase/client";

export const usePromptRuns = ({
  userProfile,
  statusFilter,
  onlyShowMyProjects,
  projectManagerFilter,
  timeFilter,
  getDateFilter,
  onlyShowLatestRuns = false,
  excludeReminderActions = false,
  onlyPendingActions = false
}: UsePromptRunsProps) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { handleRatingChange, handleFeedbackChange } = usePromptFeedback((updater) => {
    setPromptRuns(updater);
  });
  const { fetchPromptRuns: fetchData } = usePromptRunsFetcher();

  const fetchPromptRuns = async () => {
    if (!userProfile?.profile_associated_company) {
      console.warn('User has no profile_associated_company in profile, cannot fetch projects');
      setPromptRuns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // First, fetch prompt runs - using pagination
      const PAGE_SIZE = 50; // Reduce number of items per page
      let formattedData: PromptRun[] = [];
      let page = 0;
      let hasMore = true;
      
      // First fetch with pagination to get base data
      while (hasMore && page < 3) { // Limit to 3 pages max to avoid excessive loading
        console.log(`Fetching prompt runs page ${page}...`);
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const result = await fetchData(statusFilter, from, to);
        
        if (result && result.length > 0) {
          formattedData = [...formattedData, ...result];
          page++;
          
          // Check if we've reached the last page
          if (result.length < PAGE_SIZE) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      // Filter by project manager if selected - do this in-memory after initial fetch
      if (projectManagerFilter && formattedData.length > 0) {
        const { data: projectsWithManager, error: projectsError } = await supabase
          .from('projects')
          .select('id')
          .eq('project_manager', projectManagerFilter);
        
        if (!projectsError && projectsWithManager) {
          const projectIds = new Set(projectsWithManager.map(p => p.id));
          formattedData = formattedData.filter(run => 
            run.project_id && projectIds.has(run.project_id)
          );
        }
      }

      // Apply the "only show my projects" filter if enabled
      if (onlyShowMyProjects && userProfile?.id && formattedData.length > 0) {
        const { data: myProjects, error: myProjectsError } = await supabase
          .from('projects')
          .select('id')
          .eq('project_manager', userProfile.id);
        
        if (!myProjectsError && myProjects) {
          const myProjectIds = new Set(myProjects.map(p => p.id));
          formattedData = formattedData.filter(run => 
            run.project_id && myProjectIds.has(run.project_id)
          );
        }
      }

      // Fetch company base URL for CRM links
      if (formattedData.length > 0) {
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('company_project_base_URL')
          .eq('id', userProfile.profile_associated_company)
          .single();
        
        if (!companyError && company && company.company_project_base_URL) {
          formattedData = formattedData.map(run => {
            if (run.project_name) {
              return {
                ...run,
                project_crm_url: `${company.company_project_base_URL}${run.project_name}`
              };
            }
            return run;
          });
        }
      }

      // Fetch roofer contact info in small batches if needed
      if (formattedData.length > 0) {
        const projectsWithoutRooferInfo = formattedData
          .filter(run => !run.project_roofer_contact && run.project_id)
          .map(run => run.project_id);
          
        if (projectsWithoutRooferInfo.length > 0) {
          // Split into batches of 20 to avoid URI too long errors
          const BATCH_SIZE = 20;
          const projectBatches = [];
          
          for (let i = 0; i < projectsWithoutRooferInfo.length; i += BATCH_SIZE) {
            projectBatches.push(projectsWithoutRooferInfo.slice(i, i + BATCH_SIZE));
          }
          
          const rooferContactMap = new Map();
          
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
              }
            } catch (error) {
              console.error("Error fetching batch of roofer contacts:", error);
            }
          }
          
          // Apply roofer contact info to prompt runs
          formattedData = formattedData.map(run => {
            if (run.project_id && rooferContactMap.has(run.project_id)) {
              return {
                ...run,
                project_roofer_contact: rooferContactMap.get(run.project_id)
              };
            }
            return run;
          });
        }
      }

      if (onlyShowLatestRuns === true && formattedData.length > 0) {
        const latestRunsByProject = new Map<string, PromptRun>();
        
        formattedData.forEach(run => {
          if (!run.project_id) return;
          
          const existingRun = latestRunsByProject.get(run.project_id);
          
          if (!existingRun || new Date(run.created_at) > new Date(existingRun.created_at)) {
            latestRunsByProject.set(run.project_id, run);
          }
        });
        
        formattedData = Array.from(latestRunsByProject.values());
        formattedData.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      if (excludeReminderActions && formattedData.length > 0) {
        // Process in batches to avoid large queries
        const BATCH_SIZE = 50;
        const promptRunBatches = [];
        const promptRunIds = formattedData.map(run => run.id);
        
        for (let i = 0; i < promptRunIds.length; i += BATCH_SIZE) {
          promptRunBatches.push(promptRunIds.slice(i, i + BATCH_SIZE));
        }
        
        const filteredActionRunIds = new Set();
        
        for (const batchIds of promptRunBatches) {
          try {
            const { data: actionData, error: actionError } = await supabase
              .from('action_records')
              .select('prompt_run_id, action_type')
              .in('prompt_run_id', batchIds);
              
            if (!actionError && actionData) {
              actionData
                .filter(action => 
                  action.action_type === 'set_future_reminder' || 
                  action.action_type === 'NO_ACTION'
                )
                .forEach(action => filteredActionRunIds.add(action.prompt_run_id));
            }
          } catch (error) {
            console.error("Error fetching batch of action records:", error);
          }
        }

        formattedData = formattedData.filter(
          run => !filteredActionRunIds.has(run.id)
        );
      }

      if (onlyPendingActions && formattedData.length > 0) {
        // Process in batches for pending actions too
        const BATCH_SIZE = 50;
        const promptRunBatches = [];
        const promptRunIds = formattedData.map(run => run.id);
        
        for (let i = 0; i < promptRunIds.length; i += BATCH_SIZE) {
          promptRunBatches.push(promptRunIds.slice(i, i + BATCH_SIZE));
        }
        
        const pendingActionRunIds = new Set();
        
        for (const batchIds of promptRunBatches) {
          try {
            const { data: actionData, error: actionError } = await supabase
              .from('action_records')
              .select('prompt_run_id')
              .in('prompt_run_id', batchIds)
              .eq('status', 'pending');
              
            if (!actionError && actionData) {
              actionData.forEach(action => pendingActionRunIds.add(action.prompt_run_id));
            }
          } catch (error) {
            console.error("Error fetching batch of pending action records:", error);
          }
        }

        formattedData = pendingActionRunIds.size > 0 
          ? formattedData.filter(run => pendingActionRunIds.has(run.id))
          : formattedData;
      }

      setPromptRuns(formattedData);
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      console.log("Forcing a data refresh on component mount");
      fetchPromptRuns();
    }
  }, [
    statusFilter, 
    userProfile, 
    onlyShowMyProjects, 
    projectManagerFilter, 
    timeFilter, 
    onlyShowLatestRuns,
    excludeReminderActions,
    onlyPendingActions
  ]);

  return {
    promptRuns,
    setPromptRuns,
    loading,
    error,
    handleRatingChange,
    handleFeedbackChange,
    fetchPromptRuns
  };
};
