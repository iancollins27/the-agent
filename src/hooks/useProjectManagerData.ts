
import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTimeFilter, TIME_FILTERS } from "@/hooks/useTimeFilter";
import { useFilterPersistence } from "@/hooks/useFilterPersistence";
import { PromptRun } from '../components/admin/types';
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedPromptRuns } from './usePaginatedPromptRuns';

export const useProjectManagerData = () => {
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { timeFilter: rawTimeFilter, setTimeFilter: rawSetTimeFilter, getDateFilter } = useTimeFilter(TIME_FILTERS.ALL);
  
  // Reduced page size to prevent resource exhaustion
  const PAGE_SIZE = 5;
  
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
    reducedPageSize: false // Added this property with a default value
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
  
  // Sync the raw time filter with our persisted time filter
  useEffect(() => {
    rawSetTimeFilter(timeFilter);
  }, [timeFilter, rawSetTimeFilter]);

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (error) {
          console.error('Error fetching user profile:', error);
          setFetchError(`Failed to load user profile: ${error.message}`);
        } else {
          console.log('User profile loaded:', data);
          setUserProfile(data);
          setFetchError(null);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setFetchError('Failed to load user profile data');
      }
    };
    
    fetchUserProfile();
  }, [user]);

  // Handle filter dependencies
  useEffect(() => {
    if (onlyMyProjects) {
      updateFilter('projectManagerFilter', null);
    }
  }, [onlyMyProjects, updateFilter]);

  useEffect(() => {
    if (projectManagerFilter) {
      updateFilter('onlyMyProjects', false);
    }
  }, [projectManagerFilter, updateFilter]);

  // Use the paginated prompt runs hook to fetch and manage data
  const { 
    promptRuns, 
    loading, 
    error,
    handleRatingChange, 
    handleFeedbackChange, 
    fetchPromptRuns,
    setPromptRuns,
    currentPage,
    setCurrentPage,
    totalCount,
    hasMorePages,
    loadMore: loadMorePromptRuns
  } = usePaginatedPromptRuns({
    userProfile,
    statusFilter: filters.statusFilter,
    onlyShowMyProjects: filters.onlyMyProjects,
    projectManagerFilter: filters.projectManagerFilter,
    timeFilter: filters.timeFilter,
    getDateFilter,
    onlyShowLatestRuns: true,
    excludeReminderActions: filters.excludeReminderActions,
    onlyPendingActions: filters.onlyPendingActions,
    pageSize: effectivePageSize
  });

  // Update fetch error from prompt runs hook
  useEffect(() => {
    if (error) {
      setFetchError(error);
    }
  }, [error]);

  // Process prompt runs for display
  const processedPromptRuns = React.useMemo(() => {
    let runs = [...promptRuns];

    if (filters.sortRooferAlphabetically) {
      runs.sort((a, b) => {
        const rooferA = a.project_roofer_contact || 'zzz';
        const rooferB = b.project_roofer_contact || 'zzz';
        return rooferA.localeCompare(rooferB);
      });
    }
    
    return runs;
  }, [promptRuns, filters.sortRooferAlphabetically]);

  // Various handlers for UI interactions
  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  const handleRunReviewed = (promptRunId: string) => {
    setPromptRuns(prev => 
      prev.map(run => 
        run.id === promptRunId ? { ...run, reviewed: true } : run
      )
    );
  };

  const handlePromptRerun = () => {
    fetchPromptRuns();
  };

  // Handle retry with fewer items
  const handleRetryWithFewerItems = () => {
    // Reduce page size temporarily to load critical data
    updateFilter('reducedPageSize', true);
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
    loading,
    fetchError,
    processedPromptRuns,
    user,
    userProfile,
    updateFilter,
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
