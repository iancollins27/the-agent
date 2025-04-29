
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from "@/components/admin/types";
import { useToast } from "@/components/ui/use-toast";

// Constants for circuit breaking and request management
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;
const REQUEST_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

// Debounce function to prevent rapid successive calls
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Main hook for fetching prompt runs with caching
export function useCachedPromptRuns({
  statusFilter,
  pageSize,
  userProfileId,
  companyId,
  onlyMyProjects,
  projectManagerFilter,
  onlyPendingActions,
  timeFilter
}: {
  statusFilter: string | null;
  pageSize: number;
  userProfileId: string | null;
  companyId: string | null;
  onlyMyProjects: boolean;
  projectManagerFilter: string | null;
  onlyPendingActions: boolean;
  timeFilter: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Generate stable query key that changes only when filters change
  const queryKey = [
    "prompt-runs", 
    {
      statusFilter, 
      pageSize, 
      currentPage,
      userProfileId,
      companyId,
      onlyMyProjects,
      projectManagerFilter,
      onlyPendingActions,
      timeFilter
    }
  ];

  // Function to fetch a single page of data from Supabase
  async function fetchPromptRunsPage() {
    // Skip fetch if we don't have needed parameters
    if (!companyId) {
      return { data: [], totalCount: 0, hasMore: false };
    }

    try {
      // Calculate range for pagination
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      
      console.log(`Fetching prompt runs page ${currentPage} (range ${from}-${to})`);
      
      // Base query with optimized select fields 
      let query = supabase
        .from('prompt_runs')
        .select(`
          id,
          status,
          created_at,
          prompt_input,
          prompt_output,
          error_message,
          feedback_rating,
          feedback_description,
          feedback_tags,
          reviewed,
          project_id,
          projects:project_id (
            id,
            crm_id, 
            Address,
            project_manager,
            next_step
          ),
          workflow_prompts:workflow_prompt_id (type)
        `, { count: 'estimated' })
        .order('created_at', { ascending: false });

      // Apply server-side filters when possible
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      // Apply time filter if specified
      if (timeFilter && timeFilter !== 'all') {
        let timeConstraint;
        const now = new Date();
        
        switch(timeFilter) {
          case 'last_hour':
            timeConstraint = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
            break;
          case 'last_24_hours':
            timeConstraint = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'last_7_days':
            timeConstraint = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
          default:
            timeConstraint = null;
        }
        
        if (timeConstraint) {
          query = query.gte('created_at', timeConstraint);
        }
      }

      // Filter by project manager if specified
      if (projectManagerFilter) {
        // We need to get all projects first with the given project manager
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id')
          .eq('project_manager', projectManagerFilter);
          
        if (projectsData && projectsData.length > 0) {
          const projectIds = projectsData.map(p => p.id);
          query = query.in('project_id', projectIds);
        } else {
          // If no projects found for this manager, return empty result
          return { data: [], totalCount: 0, hasMore: false };
        }
      }
      
      // Apply pagination after filters
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      // Process results serverside when possible
      let results = data || [];
      let totalCount = count || 0;

      // Handle client-side filtering for specific filters
      if (onlyMyProjects && userProfileId) {
        // Get project IDs for this user (with cache)
        const cachedProjects = queryClient.getQueryData(["myProjects", userProfileId]);
        
        if (cachedProjects) {
          const myProjectIds = new Set(cachedProjects as string[]);
          results = results.filter(run => run.project_id && myProjectIds.has(run.project_id));
        } else {
          const { data: myProjects } = await supabase
            .from('projects')
            .select('id')
            .eq('project_manager', userProfileId)
            .limit(100);
            
          if (myProjects) {
            const myProjectIds = new Set(myProjects.map(p => p.id));
            // Cache for reuse
            queryClient.setQueryData(["myProjects", userProfileId], 
              myProjects.map(p => p.id));
            results = results.filter(run => run.project_id && myProjectIds.has(run.project_id));
          }
        }
      }

      // Format the data for display
      const formattedData = results.map(run => {
        return {
          id: run.id,
          status: run.status,
          created_at: run.created_at,
          prompt_text: run.prompt_input,
          result: run.prompt_output,
          project_id: run.project_id,
          project_name: run.projects?.crm_id || '',
          project_address: run.projects?.Address || '',
          feedback_rating: run.feedback_rating,
          feedback_description: run.feedback_description,
          feedback_tags: run.feedback_tags,
          reviewed: run.reviewed,
          error_message: run.error_message,
          workflow_type: run.workflow_prompts?.type || '',
          project_next_step: run.projects?.next_step || ''
        } as PromptRun;
      });

      // Add roofer contact info in a second efficient batch
      if (formattedData.length > 0) {
        const projectIds = formattedData
          .filter(run => run.project_id)
          .map(run => run.project_id as string);
          
        if (projectIds.length > 0) {
          try {
            const { data: contactsData } = await supabase
              .from('project_contacts')
              .select(`
                project_id,
                contacts:contact_id (
                  id, full_name, role
                )
              `)
              .in('project_id', projectIds.slice(0, 10)) // Limit to first 10 to prevent URL too long
              .filter('contacts.role', 'eq', 'Roofer');
              
            if (contactsData) {
              const rooferContactMap = new Map();
              contactsData.forEach(item => {
                if (item.contacts && item.project_id) {
                  rooferContactMap.set(item.project_id, item.contacts.full_name);
                }
              });
              
              // Apply roofer contact info
              formattedData.forEach(run => {
                if (run.project_id && rooferContactMap.has(run.project_id)) {
                  run.project_roofer_contact = rooferContactMap.get(run.project_id);
                }
              });
            }
          } catch (error) {
            console.warn("Error fetching roofer contacts:", error);
          }
        }
      }
      
      // Handle pending actions filter if needed
      if (onlyPendingActions && formattedData.length > 0) {
        const promptRunIds = formattedData.map(run => run.id).slice(0, 10);
        
        try {
          const { data: actionData } = await supabase
            .from('action_records')
            .select('prompt_run_id')
            .in('prompt_run_id', promptRunIds)
            .eq('status', 'pending');
            
          if (actionData && actionData.length > 0) {
            const pendingActionRunIds = new Set(actionData.map(a => a.prompt_run_id));
            return { 
              data: formattedData.filter(run => pendingActionRunIds.has(run.id)),
              totalCount: pendingActionRunIds.size, 
              hasMore: false  // Simplified - we won't know exact count with client filtering
            };
          } else {
            return { data: [], totalCount: 0, hasMore: false };
          }
        } catch (error) {
          console.warn("Error filtering by pending actions:", error);
        }
      }

      return {
        data: formattedData,
        totalCount,
        hasMore: results.length === pageSize
      };
    } catch (error) {
      console.error("Error fetching prompt runs:", error);
      throw error;
    }
  }

  // Set up the query using Tanstack Query
  const {
    data: results,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: fetchPromptRunsPage,
    staleTime: 60000, // 1 minute before considered stale
    retry: MAX_RETRIES,
    retryDelay: RETRY_DELAY,
    refetchOnWindowFocus: false,
    gcTime: REQUEST_CACHE_TIME
  });

  // Debounced version of refetch to prevent hammering the server
  const debouncedRefetch = debounce(() => {
    refetch();
  }, 300);

  // Reset to first page when filters change
  const resetToFirstPage = () => {
    setCurrentPage(0);
  };

  // Handle retry with reduced data
  const handleRetryWithFewerItems = () => {
    // Try with an even smaller page size by updating context
    setHasError(false); // Reset error state
    queryClient.invalidateQueries({ queryKey: ["prompt-runs"] });
    // Give it a moment before retrying
    setTimeout(() => refetch(), 500);
  };

  // Show error toasts when needed, but only once
  if (error && !hasError) {
    setHasError(true);
    toast({
      variant: "destructive",
      title: "Error loading data",
      description: "There was a problem fetching data. You can try with fewer filters or a smaller page size."
    });
  }

  return {
    promptRuns: results?.data || [],
    isLoading,
    isFetching,
    error: error ? String(error) : null,
    totalCount: results?.totalCount || 0,
    hasMorePages: results?.hasMore || false,
    loadMore: () => setCurrentPage(prev => prev + 1),
    currentPage,
    setCurrentPage,
    refetch: debouncedRefetch,
    resetToFirstPage,
    handleRetryWithFewerItems
  };
}
