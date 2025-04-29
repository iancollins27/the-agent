
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import ProjectManagerLayout from "./ProjectManagerLayout";
import ProjectManagerToolbar from "./ProjectManagerToolbar";
import ProjectManagerContent from "./ProjectManagerContent";
import ProjectManagerDetailsPanel from "./ProjectManagerDetailsPanel";
import { useProjectManagerData } from '@/hooks/useProjectManagerData';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";

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
    pageSize,
    handleRetryWithFewerItems
  } = useProjectManagerData();

  // Estimate total pages based on totalCount and pageSize
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 0;

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

      {fetchError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription className="flex flex-col md:flex-row items-start md:items-center justify-between">
            <div className="mb-2 md:mb-0">
              There was an error loading the prompt runs. This may be due to too many projects or database timeout.
              {fetchError && <div className="text-xs mt-1 opacity-80">{fetchError}</div>}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRetryWithFewerItems}
              >
                <AlertTriangle className="mr-2 h-4 w-4" /> Try with fewer items
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fetchPromptRuns()}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <ProjectManagerContent 
        loading={loading}
        promptRuns={processedPromptRuns}
        hideReviewed={hideReviewed}
        getEmptyStateMessage={getEmptyStateMessage}
        groupByRoofer={groupByRoofer}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        hasMorePages={hasMorePages}
        onLoadMore={loadMorePromptRuns}
        pageSize={pageSize}
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
