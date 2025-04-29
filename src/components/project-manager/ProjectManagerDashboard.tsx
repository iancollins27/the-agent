
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import ProjectManagerLayout from "./ProjectManagerLayout";
import ProjectManagerToolbar from "./ProjectManagerToolbar";
import ProjectManagerContent from "./ProjectManagerContent";
import ProjectManagerDetailsPanel from "./ProjectManagerDetailsPanel";
import { useProjectManagerData } from '@/hooks/useProjectManagerData';

const ProjectManagerDashboard: React.FC = () => {
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
    <ProjectManagerLayout>
      <ProjectManagerToolbar
        hideReviewed={hideReviewed}
        excludeReminderActions={excludeReminderActions}
        timeFilter={timeFilter}
        statusFilter={statusFilter}
        onlyMyProjects={onlyMyProjects}
        projectManagerFilter={projectManagerFilter}
        groupByRoofer={groupByRoofer}
        sortRooferAlphabetically={sortRooferAlphabetically}
        onlyPendingActions={onlyPendingActions}
        updateFilter={updateFilter}
        fetchPromptRuns={fetchPromptRuns}
      />

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

      <ProjectManagerDetailsPanel
        selectedRun={selectedRun}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        onRatingChange={handleRatingChange}
        onFeedbackChange={handleFeedbackChange}
        onPromptRerun={handlePromptRerun}
      />
      
      <Toaster />
    </ProjectManagerLayout>
  );
};

export default ProjectManagerDashboard;
