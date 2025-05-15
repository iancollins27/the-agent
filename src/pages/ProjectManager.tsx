
import React from 'react';
import ProjectManagerNav from "../components/ProjectManagerNav";
import PromptRunDetails from '../components/admin/PromptRunDetails';
import ProjectManagerHeader from "../components/project-manager/ProjectManagerHeader";
import ProjectManagerFilters from "../components/project-manager/ProjectManagerFilters";
import ProjectManagerContent from "../components/project-manager/ProjectManagerContent";
import { useProjectManagerState } from '@/hooks/useProjectManagerState';

const ProjectManager: React.FC = () => {
  const {
    selectedRun,
    detailsOpen,
    setDetailsOpen,
    userProfile,
    filters,
    updateFilter,
    promptRuns,
    loading,
    handleRatingChange,
    handleFeedbackChange,
    fetchPromptRuns,
    viewPromptRunDetails,
    handleRunReviewed,
    handlePromptRerun,
    getEmptyStateMessage
  } = useProjectManagerState();

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <ProjectManagerHeader title="Project Manager Dashboard" />
          <ProjectManagerFilters 
            hideReviewed={filters.hideReviewed}
            setHideReviewed={(value) => updateFilter('hideReviewed', value)}
            excludeReminderActions={filters.excludeReminderActions}
            setExcludeReminderActions={(value) => updateFilter('excludeReminderActions', value)}
            timeFilter={filters.timeFilter}
            setTimeFilter={(value) => updateFilter('timeFilter', value)}
            statusFilter={filters.statusFilter}
            setStatusFilter={(value) => updateFilter('statusFilter', value)}
            onlyMyProjects={filters.onlyMyProjects}
            setOnlyMyProjects={(value) => updateFilter('onlyMyProjects', value)}
            projectManagerFilter={filters.projectManagerFilter}
            setProjectManagerFilter={(value) => updateFilter('projectManagerFilter', value)}
            groupByRoofer={filters.groupByRoofer}
            setGroupByRoofer={(value) => updateFilter('groupByRoofer', value)}
            sortRooferAlphabetically={filters.sortRooferAlphabetically}
            setSortRooferAlphabetically={(value) => updateFilter('sortRooferAlphabetically', value)}
            onRefresh={fetchPromptRuns}
            onlyPendingActions={filters.onlyPendingActions}
            setOnlyPendingActions={(value) => updateFilter('onlyPendingActions', value)}
          />
        </div>

        <ProjectManagerContent 
          loading={loading}
          promptRuns={promptRuns}
          hideReviewed={filters.hideReviewed}
          getEmptyStateMessage={getEmptyStateMessage}
          groupByRoofer={filters.groupByRoofer}
          debugInfo={{
            userId: userProfile?.id,
            companyId: userProfile?.profile_associated_company,
            statusFilter: filters.statusFilter,
            onlyMyProjects: filters.onlyMyProjects,
            projectManagerFilter: filters.projectManagerFilter,
            timeFilter: filters.timeFilter
          }}
          onViewDetails={viewPromptRunDetails}
          onRatingChange={handleRatingChange}
          onRunReviewed={handleRunReviewed}
          onPromptRerun={handlePromptRerun}
        />

        {selectedRun && (
          <PromptRunDetails 
            promptRun={selectedRun} 
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            onRatingChange={handleRatingChange}
            onFeedbackChange={handleFeedbackChange}
            onPromptRerun={handlePromptRerun}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectManager;
