import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useFilterPersistence } from "@/hooks/useFilterPersistence";
import { TIME_FILTERS } from "@/hooks/useTimeFilter";
import { useCachedPromptRuns } from './useCachedPromptRuns';
import { usePromptFeedbackManager } from './usePromptFeedbackManager';
import { PromptRun } from '../components/admin/types';
import { fetchUserProfile } from '@/api/user-profile';

export const useProjectManagerData = () => {
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Filter state management using persistence hook
  const { filters, updateFilter } = useFilterPersistence({
    hideReviewed: true,
    excludeReminderActions: false,
    timeFilter: TIME_FILTERS.ALL,
    statusFilter: null,
    onlyMyProjects: false,
    projectManagerFilter: null,
    groupByRoofer: false,
    sortRooferAlphabetically: true,
    onlyPendingActions: false,
    reducedPageSize: false
  });
  
  // Destructure filters for easier access
  const {
    hideReviewed,
    excludeReminderActions,
    timeFilter,
    statusFilter,
    onlyMyProjects,
    projectManagerFilter,
    groupByRoofer,
    sortRooferAlphabetically,
    onlyPendingActions,
    reducedPageSize
  } = filters;
  
  // Calculate effective page size based on reduced mode
  const PAGE_SIZE = 5;
  const effectivePageSize = reducedPageSize ? 2 : PAGE_SIZE;
  
  // Reset reduced page size after successful load
  useEffect(() => {
    if (reducedPageSize) {
      const timer = setTimeout(() => {
        updateFilter('reducedPageSize', false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [reducedPageSize, updateFilter]);

  // Fetch user profile data on mount
  useEffect(() => {
    const getUserProfile = async () => {
      if (!user) return;
      
      try {
        // Use the direct Supabase query instead of the API route
        const { data, error } = await fetchUserProfile(user.id);
          
        if (error) {
          console.error('Error fetching user profile:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: `Failed to load user profile: ${error.message}`
          });
        } else {
          setUserProfile(data);
        }
      } catch (error: any) {
        console.error('Error fetching user profile:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: 'Failed to load user profile data'
        });
      }
    };
    
    getUserProfile();
  }, [user, toast]);

  // Use the cached prompt runs hook for data fetching
  const {
    promptRuns,
    isLoading,
    isFetching,
    error: fetchError,
    totalCount,
    hasMorePages,
    loadMore: loadMorePromptRuns,
    currentPage,
    setCurrentPage,
    refetch: fetchPromptRuns,
    resetToFirstPage,
    handleRetryWithFewerItems
  } = useCachedPromptRuns({
    statusFilter, 
    pageSize: effectivePageSize,
    userProfileId: user?.id || null,
    companyId: userProfile?.profile_associated_company || null,
    onlyMyProjects,
    projectManagerFilter,
    onlyPendingActions,
    timeFilter
  });

  // Use the feedback manager hook
  const {
    handleRatingChange,
    handleFeedbackChange,
    handleRunReviewed
  } = usePromptFeedbackManager();

  // Process prompt runs for display
  const processedPromptRuns = useState(() => {
    let runs = [...promptRuns];

    // Apply hide reviewed filter if needed
    if (hideReviewed) {
      runs = runs.filter(run => !run.reviewed);
    }

    // Apply alphabetical sorting if needed
    if (sortRooferAlphabetically) {
      runs.sort((a, b) => {
        const rooferA = a.project_roofer_contact || 'zzz';
        const rooferB = b.project_roofer_contact || 'zzz';
        return rooferA.localeCompare(rooferB);
      });
    }
    
    return runs;
  })[0];

  // Various handlers for UI interactions
  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  const handlePromptRerun = () => {
    fetchPromptRuns();
  };

  // Generate appropriate empty state message
  const getEmptyStateMessage = () => {
    if (!user) {
      return "Please log in to view your project data";
    }
    
    if (!userProfile?.profile_associated_company) {
      return "Your user profile is not associated with a company. Contact your administrator.";
    }
    
    if (fetchError) {
      return `Error loading data: ${fetchError}. Try refreshing the page or try again with fewer filters.`;
    }
    
    if (filters.onlyMyProjects) {
      return "No prompt runs found for your projects. Try unchecking 'Only My Projects' filter.";
    }
    
    if (filters.projectManagerFilter) {
      return "No prompt runs found for the selected project manager's projects.";
    }
    
    if (filters.statusFilter) {
      return `No prompt runs found with the '${filters.statusFilter}' status. Try selecting a different status.`;
    }
    
    if (filters.timeFilter !== TIME_FILTERS.ALL) {
      return `No prompt runs found within the selected time range. Try selecting a different time range.`;
    }
    
    return "No prompt runs found for your company's projects. This could be because:\n1. No prompt runs have been created yet\n2. You don't have access to the projects with prompt runs";
  };

  // Handle filter changes with automatic view reset
  const handleFilterChange = <K extends string>(key: K, value: any) => {
    updateFilter(key, value);
    resetToFirstPage(); // Reset to first page when filters change
  };

  return {
    selectedRun,
    detailsOpen,
    setDetailsOpen,
    hideReviewed,
    excludeReminderActions,
    timeFilter,
    statusFilter,
    onlyMyProjects,
    projectManagerFilter,
    groupByRoofer,
    sortRooferAlphabetically,
    onlyPendingActions,
    loading: isLoading || isFetching,
    fetchError,
    processedPromptRuns,
    user,
    userProfile,
    updateFilter: handleFilterChange,
    fetchPromptRuns,
    viewPromptRunDetails,
    handleRatingChange,
    handleFeedbackChange,
    handleRunReviewed,
    handlePromptRerun,
    getEmptyStateMessage,
    currentPage,
    setCurrentPage,
    totalCount,
    hasMorePages,
    loadMorePromptRuns,
    pageSize: effectivePageSize,
    handleRetryWithFewerItems
  };
};
