
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

  if (promptRuns.length === 0) {
    return (
      <EmptyPromptRuns
        message={getEmptyStateMessage()}
        debugInfo={debugInfo}
      />
    );
  }

  return (
    <PromptRunsTable 
      promptRuns={promptRuns} 
      onRatingChange={onRatingChange} 
      onViewDetails={onViewDetails}
      onRunReviewed={onRunReviewed}
      hideReviewed={hideReviewed}
    />
  );
};

export default ProjectManagerContent;
