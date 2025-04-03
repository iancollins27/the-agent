
import React from 'react';
import { Loader2 } from "lucide-react";
import { PromptRun } from '../admin/types';
import EmptyPromptRuns from '../admin/EmptyPromptRuns';
import PromptRunsTable from '../admin/PromptRunsTable';

interface ProjectManagerContentProps {
  loading: boolean;
  promptRuns: PromptRun[];
  hideReviewed: boolean;
  getEmptyStateMessage: () => string;
  debugInfo: {
    userId?: string;
    companyId?: string;
    statusFilter: string | null;
    onlyMyProjects: boolean;
    projectManagerFilter: string | null;
    timeFilter: string;
  };
  onViewDetails: (run: PromptRun) => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onRunReviewed: (promptRunId: string) => void;
}

const ProjectManagerContent: React.FC<ProjectManagerContentProps> = ({
  loading,
  promptRuns,
  hideReviewed,
  getEmptyStateMessage,
  debugInfo,
  onViewDetails,
  onRatingChange,
  onRunReviewed
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate the displayed projects count (after filtering for hideReviewed)
  const displayedRuns = hideReviewed 
    ? promptRuns.filter(run => !run.reviewed)
    : promptRuns;
  
  // Get unique project IDs to show actual project count
  const uniqueProjectIds = new Set(displayedRuns.map(run => run.project_id).filter(Boolean));
  const projectCount = uniqueProjectIds.size;

  if (promptRuns.length === 0) {
    return (
      <EmptyPromptRuns
        message={getEmptyStateMessage()}
        debugInfo={debugInfo}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Showing {projectCount} {projectCount === 1 ? 'project' : 'projects'} ({displayedRuns.length} {displayedRuns.length === 1 ? 'prompt run' : 'prompt runs'})
        </p>
      </div>
      
      <PromptRunsTable 
        promptRuns={promptRuns} 
        onRatingChange={onRatingChange} 
        onViewDetails={onViewDetails}
        onRunReviewed={onRunReviewed}
        hideReviewed={hideReviewed}
      />
    </div>
  );
};

export default ProjectManagerContent;
