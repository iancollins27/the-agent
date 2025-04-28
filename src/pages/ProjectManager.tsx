import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ProjectManagerNav from "../components/ProjectManagerNav";
import PromptRunDetails from '../components/admin/PromptRunDetails';
import { PromptRun } from '../components/admin/types';
import { useAuth } from "@/hooks/useAuth";
import { useTimeFilter, TIME_FILTERS } from "@/hooks/useTimeFilter";
import { usePromptRuns } from '@/hooks/usePromptRuns';
import { useFilterPersistence } from "@/hooks/useFilterPersistence";
import ProjectManagerHeader from "../components/project-manager/ProjectManagerHeader";
import ProjectManagerFilters from "../components/project-manager/ProjectManagerFilters";
import ProjectManagerContent from "../components/project-manager/ProjectManagerContent";

const ProjectManager: React.FC = () => {
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { timeFilter: rawTimeFilter, setTimeFilter: rawSetTimeFilter, getDateFilter } = useTimeFilter(TIME_FILTERS.ALL);
  
  const { filters, updateFilter } = useFilterPersistence({
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
  
  const hideReviewed = filters.hideReviewed;
  const excludeReminderActions = filters.excludeReminderActions;
  const timeFilter = filters.timeFilter;
  const statusFilter = filters.statusFilter;
  const onlyMyProjects = filters.onlyMyProjects;
  const projectManagerFilter = filters.projectManagerFilter;
  const groupByRoofer = filters.groupByRoofer;
  const sortRooferAlphabetically = filters.sortRooferAlphabetically;
  const onlyPendingActions = filters.onlyPendingActions;
  
  useEffect(() => {
    rawSetTimeFilter(timeFilter);
  }, [timeFilter]);

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
    if (onlyMyProjects) {
      updateFilter('projectManagerFilter', null);
    }
  }, [onlyMyProjects]);

  useEffect(() => {
    if (projectManagerFilter) {
      updateFilter('onlyMyProjects', false);
    }
  }, [projectManagerFilter]);

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

  console.log(`ProjectManager component: Retrieved ${promptRuns.length} prompt runs`);
  console.log(`Using latest runs filter: true`);

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

  const getEmptyStateMessage = () => {
    if (!user) {
      return "Please log in to view your project data";
    }
    
    if (!userProfile?.profile_associated_company) {
      return "Your user profile is not associated with a company. Contact your administrator.";
    }
    
    if (onlyMyProjects) {
      return "No prompt runs found for your projects. Try unchecking 'Only My Projects' filter.";
    }
    
    if (projectManagerFilter) {
      return "No prompt runs found for the selected project manager's projects.";
    }
    
    if (statusFilter) {
      return `No prompt runs found with the '${statusFilter}' status. Try selecting a different status.`;
    }
    
    if (timeFilter !== TIME_FILTERS.ALL) {
      return `No prompt runs found within the selected time range. Try selecting a different time range.`;
    }
    
    return "No prompt runs found for your company's projects. This could be because:\n1. No prompt runs have been created yet\n2. You don't have access to the projects with prompt runs";
  };

  const processedPromptRuns = React.useMemo(() => {
    let runs = [...promptRuns];

    if (sortRooferAlphabetically) {
      runs.sort((a, b) => {
        const rooferA = a.project_roofer_contact || 'zzz';
        const rooferB = b.project_roofer_contact || 'zzz';
        return rooferA.localeCompare(rooferB);
      });
    }
    
    return runs;
  }, [promptRuns, sortRooferAlphabetically]);

  useEffect(() => {
    if (userProfile) {
      console.log("Forcing a data refresh on component mount");
      fetchPromptRuns();
    }
  }, [userProfile]);

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <ProjectManagerHeader title="Project Manager Dashboard" />
          <ProjectManagerFilters 
            hideReviewed={hideReviewed}
            setHideReviewed={(value) => updateFilter('hideReviewed', value)}
            excludeReminderActions={excludeReminderActions}
            setExcludeReminderActions={(value) => updateFilter('excludeReminderActions', value)}
            timeFilter={timeFilter}
            setTimeFilter={(value) => updateFilter('timeFilter', value)}
            statusFilter={statusFilter}
            setStatusFilter={(value) => updateFilter('statusFilter', value)}
            onlyMyProjects={onlyMyProjects}
            setOnlyMyProjects={(value) => updateFilter('onlyMyProjects', value)}
            projectManagerFilter={projectManagerFilter}
            setProjectManagerFilter={(value) => updateFilter('projectManagerFilter', value)}
            groupByRoofer={groupByRoofer}
            setGroupByRoofer={(value) => updateFilter('groupByRoofer', value)}
            sortRooferAlphabetically={sortRooferAlphabetically}
            setSortRooferAlphabetically={(value) => updateFilter('sortRooferAlphabetically', value)}
            onRefresh={fetchPromptRuns}
            onlyPendingActions={onlyPendingActions}
            setOnlyPendingActions={(value) => updateFilter('onlyPendingActions', value)}
          />
        </div>

        <ProjectManagerContent 
          loading={loading}
          promptRuns={processedPromptRuns}
          hideReviewed={hideReviewed}
          getEmptyStateMessage={getEmptyStateMessage}
          groupByRoofer={groupByRoofer}
          debugInfo={{
            userId: user?.id,
            companyId: userProfile?.profile_associated_company,
            statusFilter,
            onlyMyProjects,
            projectManagerFilter,
            timeFilter
          }}
          onViewDetails={viewPromptRunDetails}
          onRatingChange={handleRatingChange}
          onRunReviewed={handleRunReviewed}
          onPromptRerun={handlePromptRerun}
        />

        <PromptRunDetails 
          promptRun={selectedRun} 
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onRatingChange={handleRatingChange}
          onFeedbackChange={handleFeedbackChange}
          onPromptRerun={handlePromptRerun}
        />
      </div>
    </div>
  );
};

export default ProjectManager;
