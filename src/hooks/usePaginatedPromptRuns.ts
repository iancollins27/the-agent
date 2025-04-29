
import { useState, useEffect, useCallback } from 'react';
import { PromptRun } from '../components/admin/types';
import { usePromptFeedback } from './usePromptFeedback';
import { usePromptRunsFetcher } from './promptRuns/usePromptRunsFetcher';
import { UsePromptRunsProps } from './promptRuns/types';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from '@/components/ui/use-toast';

// Reduced page size to prevent resource exhaustion
const DEFAULT_PAGE_SIZE = 5;

export const usePaginatedPromptRuns = ({
  userProfile,
  statusFilter,
  onlyShowMyProjects,
  projectManagerFilter,
  timeFilter,
  getDateFilter,
  onlyShowLatestRuns = false,
  excludeReminderActions = false,
  onlyPendingActions = false,
  pageSize = DEFAULT_PAGE_SIZE
}: UsePromptRunsProps & { pageSize?: number }) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [hasMorePages, setHasMorePages] = useState(true);
  const { toast } = useToast();
  
  const { handleRatingChange, handleFeedbackChange } = usePromptFeedback((updater) => {
    setPromptRuns(updater);
  });
  
  const { 
    fetchPromptRunsPage, 
    fetchRooferContacts, 
    getPromptRunsCount
  } = usePromptRunsFetcher();

  // Fetch total count of records for pagination
  const fetchTotalCount = useCallback(async () => {
    if (!userProfile?.profile_associated_company) return;
    
    try {
      const count = await getPromptRunsCount(statusFilter);
      setTotalCount(count);
    } catch (err) {
      console.error("Error fetching count:", err);
    }
  }, [userProfile?.profile_associated_company, statusFilter, getPromptRunsCount]);

  // Function to load a specific page of prompt runs
  const loadPage = useCallback(async (page: number) => {
    if (!userProfile?.profile_associated_company) {
      console.warn('User has no profile_associated_company in profile, cannot fetch projects');
      setPromptRuns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Fetch prompt runs page
      const result = await fetchPromptRunsPage(statusFilter, page, pageSize);
      
      if (result.error) {
        setError(result.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to load data: ${result.error}`,
        });
        return;
      }
      
      let formattedData = [...result.data];
      setHasMorePages(result.hasMore);
      
      // Update total count if available
      if (result.count !== null) {
        setTotalCount(result.count);
      }
      
      // Client-side filtering for project manager
      if (projectManagerFilter && formattedData.length > 0) {
        try {
          const { data: projectsWithManager, error: projectsError } = await supabase
            .from('projects')
            .select('id')
            .eq('project_manager', projectManagerFilter)
            .limit(100); // Limit to avoid resource issues
          
          if (!projectsError && projectsWithManager) {
            const projectIds = new Set(projectsWithManager.map(p => p.id));
            formattedData = formattedData.filter(run => 
              run.project_id && projectIds.has(run.project_id)
            );
          }
        } catch (err) {
          console.error("Error filtering by project manager:", err);
        }
      }

      // Apply the "only show my projects" filter if enabled
      if (onlyShowMyProjects && userProfile?.id && formattedData.length > 0) {
        try {
          const { data: myProjects, error: myProjectsError } = await supabase
            .from('projects')
            .select('id')
            .eq('project_manager', userProfile.id)
            .limit(100); // Limit to avoid resource issues
          
          if (!myProjectsError && myProjects) {
            const myProjectIds = new Set(myProjects.map(p => p.id));
            formattedData = formattedData.filter(run => 
              run.project_id && myProjectIds.has(run.project_id)
            );
          }
        } catch (err) {
          console.error("Error filtering by user's projects:", err);
        }
      }

      // Only fetch roofer contacts for this page's projects
      if (formattedData.length > 0) {
        const projectIds = formattedData
          .filter(run => run.project_id && !run.project_roofer_contact)
          .map(run => run.project_id as string);
          
        if (projectIds.length > 0) {
          try {
            const rooferContactMap = await fetchRooferContacts(projectIds);
            
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
          } catch (err) {
            console.error("Error fetching roofer contacts:", err);
          }
        }
      }

      // Apply additional filters based on actions - limit batch size
      if (onlyPendingActions && formattedData.length > 0) {
        try {
          const promptRunIds = formattedData.map(run => run.id);
          
          const { data: actionData, error: actionError } = await supabase
            .from('action_records')
            .select('prompt_run_id')
            .in('prompt_run_id', promptRunIds)
            .eq('status', 'pending')
            .limit(100);
            
          if (!actionError && actionData) {
            const pendingActionRunIds = new Set(actionData.map(a => a.prompt_run_id));
            if (pendingActionRunIds.size > 0) {
              formattedData = formattedData.filter(run => pendingActionRunIds.has(run.id));
            }
          }
        } catch (err) {
          console.error("Error filtering by pending actions:", err);
        }
      }

      // Set the results
      setPromptRuns(formattedData);
    } catch (error: any) {
      console.error('Error loading page:', error);
      setError(error?.message || 'Failed to load data. Please try again.');
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: "There was an error loading data. Try reducing your filters or the page size."
      });
    } finally {
      setLoading(false);
    }
  }, [
    userProfile,
    statusFilter,
    pageSize,
    projectManagerFilter, 
    onlyShowMyProjects,
    onlyPendingActions,
    fetchPromptRunsPage,
    fetchRooferContacts,
    toast
  ]);

  // Load more function for infinite scrolling or "Load More" button
  const loadMore = useCallback(async () => {
    if (loading || !hasMorePages) return;
    
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    
    setLoading(true);
    try {
      const result = await fetchPromptRunsPage(statusFilter, nextPage, pageSize);
      
      if (result.error) {
        setError(result.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to load more data: ${result.error}`
        });
        return;
      }
      
      let additionalData = [...result.data];
      setHasMorePages(result.hasMore);
      
      // Apply the same filtering logic as in loadPage
      // Fetch roofer contacts only for new items
      const projectIds = additionalData
        .filter(run => run.project_id && !run.project_roofer_contact)
        .map(run => run.project_id as string);
        
      if (projectIds.length > 0) {
        try {
          const rooferContactMap = await fetchRooferContacts(projectIds);
          
          // Apply roofer contact info to prompt runs
          additionalData = additionalData.map(run => {
            if (run.project_id && rooferContactMap.has(run.project_id)) {
              return {
                ...run,
                project_roofer_contact: rooferContactMap.get(run.project_id)
              };
            }
            return run;
          });
        } catch (err) {
          console.error("Error fetching roofer contacts for additional data:", err);
        }
      }
      
      // Append new data to existing data
      setPromptRuns(prevRuns => [...prevRuns, ...additionalData]);
    } catch (error: any) {
      console.error('Error loading more data:', error);
      setError(error?.message || 'Failed to load more data');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load more items. Try refreshing the page."
      });
    } finally {
      setLoading(false);
    }
  }, [
    currentPage, 
    loading,
    hasMorePages,
    statusFilter,
    pageSize,
    fetchPromptRunsPage,
    fetchRooferContacts,
    toast
  ]);

  // Function to refresh all data
  const fetchPromptRuns = useCallback(async () => {
    setCurrentPage(0);
    setHasMorePages(true);
    await loadPage(0);
    fetchTotalCount();
  }, [loadPage, fetchTotalCount]);

  // Initial data load when filters change
  useEffect(() => {
    if (userProfile?.profile_associated_company) {
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
    onlyPendingActions,
    fetchPromptRuns
  ]);

  return {
    promptRuns,
    setPromptRuns,
    loading,
    error,
    currentPage,
    totalCount,
    hasMorePages,
    loadMore,
    loadPage,
    setCurrentPage,
    handleRatingChange,
    handleFeedbackChange,
    fetchPromptRuns
  };
};
