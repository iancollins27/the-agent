
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import ProjectManagerNav from "../components/ProjectManagerNav";
import PromptRunDetails from '../components/admin/PromptRunDetails';
import ProjectManagerHeader from "../components/project-manager/ProjectManagerHeader";
import ProjectManagerFilters from "../components/project-manager/ProjectManagerFilters";
import ProjectManagerContent from "../components/project-manager/ProjectManagerContent";
import { useProjectManagerData } from '@/hooks/useProjectManagerData';

const ProjectManager: React.FC = () => {
  const {
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
    getEmptyStateMessage
  } = useProjectManagerData();

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
