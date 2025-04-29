
import React, { useMemo } from 'react';
import { PromptRun } from '../admin/types';
import PromptRunsTable from '../admin/PromptRunsTable';
import RooferPromptRunsCard from './RooferPromptRunsCard';
import { DataPagination } from '../ui/data-pagination';

interface ProjectManagerContentProps {
  loading: boolean;
  promptRuns: PromptRun[];
  hideReviewed: boolean;
  getEmptyStateMessage: () => string;
  groupByRoofer: boolean;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number | null;
  hasMorePages?: boolean;
  onLoadMore?: () => void;
  pageSize?: number;
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
  onPageChange,
  currentPage = 0,
  totalPages = 0,
  totalCount = null,
  hasMorePages = false,
  onLoadMore,
  pageSize = 20, // Increased default page size
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
    
    return Object.entries(groups).map(([roofer, runs]) => ({
      roofer,
      runs
    }));
  };
  
  const rooferGroups = groupByRoofer ? groupPromptRunsByRoofer() : [];
  
  if (loading && promptRuns.length === 0) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-slate-200 rounded"></div>
        <div className="h-64 bg-slate-200 rounded"></div>
      </div>
    );
  }
  
  if (filteredPromptRuns.length === 0 && !loading) {
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
            promptRuns={filteredPromptRuns}
            onRatingChange={onRatingChange}
            onViewDetails={onViewDetails}
            onRunReviewed={onRunReviewed}
            onPromptRerun={onPromptRerun}
            reviewFilter="all" // Set to "all" since we're already pre-filtering
            loading={loading}
          />
          
          {onPageChange && (
            <div className="flex justify-center my-4">
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
                hasMorePages={hasMorePages}
                loading={loading}
                onLoadMore={onLoadMore}
                pageSize={pageSize}
                totalItems={totalCount}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectManagerContent;
