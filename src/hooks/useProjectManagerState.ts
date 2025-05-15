
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useFilterPersistence } from "@/hooks/useFilterPersistence";
import { useTimeFilter, TIME_FILTERS } from "@/hooks/useTimeFilter";
import { usePromptRuns } from '@/hooks/usePromptRuns';
import { PromptRun } from '@/components/admin/types';

export const useProjectManagerState = () => {
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { user } = useAuth();
  const { timeFilter: rawTimeFilter, setTimeFilter: rawSetTimeFilter, getDateFilter } = useTimeFilter(TIME_FILTERS.ALL);
  
  // Initialize filterPersistence correctly with both params
  const { filters, updateFilter } = useFilterPersistence('projectManagerFilters', {
    hideReviewed: true,
    excludeReminderActions: false,
    timeFilter: TIME_FILTERS.ALL,
    statusFilter: null,
    onlyMyProjects: false,
    projectManagerFilter: null,
    groupByRoofer: false,
    sortRooferAlphabetically: true,
    onlyPendingActions: false
  });
  
  useEffect(() => {
    rawSetTimeFilter(filters.timeFilter);
  }, [filters.timeFilter, rawSetTimeFilter]);

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
        } else {
          console.log('User profile loaded:', data);
          setUserProfile(data);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (filters.onlyMyProjects) {
      updateFilter('projectManagerFilter', null);
    }
  }, [filters.onlyMyProjects, updateFilter]);

  useEffect(() => {
    if (filters.projectManagerFilter) {
      updateFilter('onlyMyProjects', false);
    }
  }, [filters.projectManagerFilter, updateFilter]);

  const { 
    promptRuns, 
    loading, 
    handleRatingChange, 
    handleFeedbackChange, 
    fetchPromptRuns,
    setPromptRuns
  } = usePromptRuns({
    userProfile,
    statusFilter: filters.statusFilter,
    onlyShowMyProjects: filters.onlyMyProjects,
    projectManagerFilter: filters.projectManagerFilter,
    timeFilter: filters.timeFilter,
    getDateFilter,
    onlyShowLatestRuns: true,
    excludeReminderActions: filters.excludeReminderActions,
    onlyPendingActions: filters.onlyPendingActions
  });

  console.log(`ProjectManager hook: Retrieved ${promptRuns.length} prompt runs`);
  console.log(`Using latest runs filter: true`);

  const processedPromptRuns = useMemo(() => {
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

  const getEmptyStateMessage = () => {
    if (!user) {
      return "Please log in to view your project data";
    }
    
    if (!userProfile?.profile_associated_company) {
      return "Your user profile is not associated with a company. Contact your administrator.";
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
    userProfile,
    filters,
    updateFilter,
    promptRuns: processedPromptRuns,
    loading,
    handleRatingChange,
    handleFeedbackChange,
    fetchPromptRuns,
    viewPromptRunDetails: (run: PromptRun) => {
      setSelectedRun(run);
      setDetailsOpen(true);
    },
    handleRunReviewed: (promptRunId: string) => {
      setPromptRuns(prev => 
        prev.map(run => 
          run.id === promptRunId ? { ...run, reviewed: true } : run
        )
      );
    },
    handlePromptRerun: () => {
      fetchPromptRuns();
    },
    getEmptyStateMessage
  };
};
