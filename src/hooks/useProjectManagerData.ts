
import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useFilterPersistence } from "@/hooks/useFilterPersistence";
import { TIME_FILTERS } from "@/hooks/useTimeFilter";
import { useCachedPromptRuns } from './useCachedPromptRuns';
import { usePromptFeedbackManager } from './usePromptFeedbackManager';
import { usePromptRunSelection } from './project-manager/usePromptRunSelection';
import { useUserProfileData } from './project-manager/useUserProfileData';
import { usePromptRunProcessor } from './project-manager/usePromptRunProcessor';
import { useEmptyStateMessage } from './project-manager/useEmptyStateMessage';
import { usePageSizeHandler } from './project-manager/usePageSizeHandler';

export const useProjectManagerData = () => {
  const { toast } = useToast();
  
  // Use the user profile data hook
  const { user, userProfile } = useUserProfileData();
  
  // Use the prompt run selection hook
  const { 
    selectedRun, 
    detailsOpen, 
    setDetailsOpen, 
    viewPromptRunDetails 
  } = usePromptRunSelection();
  
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
  
  // Use the page size handler hook
  const { effectivePageSize } = usePageSizeHandler(
    reducedPageSize, 
    updateFilter
  );

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

  // Use the prompt run processor hook
  const { processedPromptRuns } = usePromptRunProcessor(
    promptRuns,
    hideReviewed,
    sortRooferAlphabetically
  );

  // Use the empty state message hook
  const { getEmptyStateMessage } = useEmptyStateMessage(
    userProfile, 
    { onlyMyProjects, projectManagerFilter, statusFilter, timeFilter },
    fetchError
  );

  // Use the feedback manager hook
  const {
    handleRatingChange,
    handleFeedbackChange,
    handleRunReviewed
  } = usePromptFeedbackManager();

  // Handle filter changes with automatic view reset
  const handleFilterChange = <K extends string>(key: K, value: any) => {
    updateFilter(key, value);
    resetToFirstPage(); // Reset to first page when filters change
  };

  // Handle prompt rerun
  const handlePromptRerun = () => {
    fetchPromptRuns();
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
