
import React from 'react';
import { PromptRun } from '../admin/types';
import PromptRunsTable from '../admin/PromptRunsTable';
import RooferPromptRunsCard from './RooferPromptRunsCard';

interface ProjectManagerContentProps {
  loading: boolean;
  promptRuns: PromptRun[];
  hideReviewed: boolean;
  getEmptyStateMessage: () => string;
  groupByRoofer: boolean;
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
  onPromptRerun?: () => void;
}

const ProjectManagerContent: React.FC<ProjectManagerContentProps> = ({
  loading,
  promptRuns,
  hideReviewed,
  getEmptyStateMessage,
  groupByRoofer,
  debugInfo,
  onViewDetails,
  onRatingChange,
  onRunReviewed,
  onPromptRerun
}) => {
  // Function to group prompt runs by roofer contact
  const groupPromptRunsByRoofer = () => {
    const groups: { [key: string]: PromptRun[] } = {};
    
    promptRuns.forEach(run => {
      const rooferKey = run.project_roofer_contact || 'Unassigned';
      
      if (!groups[rooferKey]) {
        groups[rooferKey] = [];
      }
      
      groups[rooferKey].push(run);
    });
    
    return Object.entries(groups).map(([roofer, runs]) => ({
      roofer,
      runs
    }));
  };
  
  const rooferGroups = groupByRoofer ? groupPromptRunsByRoofer() : [];
  
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-slate-200 rounded"></div>
        <div className="h-64 bg-slate-200 rounded"></div>
      </div>
    );
  }
  
  if (promptRuns.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-lg font-medium mb-2">No Prompt Runs Found</h3>
        <p className="text-gray-600 whitespace-pre-line">{getEmptyStateMessage()}</p>
        
        {/* Debug info */}
        <div className="mt-6 p-4 bg-slate-50 rounded text-xs text-slate-500">
          <p>Debug info:</p>
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      {groupByRoofer ? (
        <div className="space-y-6">
          {rooferGroups.map(({ roofer, runs }) => (
            <RooferPromptRunsCard
              key={roofer}
              roofer={roofer}
              promptRuns={runs}
              onViewDetails={onViewDetails}
              onRatingChange={onRatingChange}
              onRunReviewed={onRunReviewed}
              onPromptRerun={onPromptRerun}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <PromptRunsTable 
            promptRuns={promptRuns}
            onRatingChange={onRatingChange}
            onViewDetails={onViewDetails}
            hideReviewed={hideReviewed}
            onRunReviewed={onRunReviewed}
            onPromptRerun={onPromptRerun}
          />
        </div>
      )}
    </div>
  );
};

export default ProjectManagerContent;
