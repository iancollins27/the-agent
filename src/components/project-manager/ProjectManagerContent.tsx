
import React, { useMemo } from 'react';
import { PromptRun } from '../admin/types';
import PromptRunsTable from '../admin/PromptRunsTable';
import RooferPromptRunsCard from './RooferPromptRunsCard';
import { Smile } from 'lucide-react';

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
  onPromptRerun?: (promptRunId: string) => void;
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
  // Filter prompt runs based on hideReviewed prop
  const filteredPromptRuns = useMemo(() => {
    if (hideReviewed) {
      return promptRuns.filter(run => !run.reviewed);
    }
    return promptRuns;
  }, [promptRuns, hideReviewed]);
  
  // Function to group prompt runs by roofer contact
  const groupPromptRunsByRoofer = () => {
    const groups: { [key: string]: PromptRun[] } = {};
    
    filteredPromptRuns.forEach(run => {
      const rooferKey = run.project_roofer_contact || 'Unassigned';
      
      if (!groups[rooferKey]) {
        groups[rooferKey] = [];
      }
      
      groups[rooferKey].push(run);
    });
    
    // Sort roofer groups alphabetically
    return Object.entries(groups)
      .sort(([rooferA], [rooferB]) => rooferA.localeCompare(rooferB))
      .map(([roofer, runs]) => ({
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
  
  if (filteredPromptRuns.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
        <Smile className="h-16 w-16 text-green-400 mb-4" />
        <h3 className="text-xl font-medium mb-2">You're all caught up!</h3>
        <p className="text-gray-600 max-w-md">
          You currently have no pending projects that require your attention.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left w-full text-xs bg-slate-50 p-2 rounded border">
            <summary className="cursor-pointer text-slate-500 font-mono">Debug information</summary>
            <pre className="mt-2 text-slate-600 overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        )}
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
            promptRuns={filteredPromptRuns}
            onRatingChange={onRatingChange}
            onViewDetails={onViewDetails}
            onRunReviewed={onRunReviewed}
            onPromptRerun={onPromptRerun}
            reviewFilter="all" // Set to "all" since we're already pre-filtering
          />
        </div>
      )}
    </div>
  );
};

export default ProjectManagerContent;
