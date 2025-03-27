
import React, { useState } from 'react';
import PromptRunsTable from '../PromptRunsTable';
import PromptRunDetails from '../PromptRunDetails';
import { PromptRun } from '../types';
import PromptRunHeader from './PromptRunHeader';
import PromptRunLoader from './PromptRunLoader';
import EmptyPromptRunsState from './EmptyPromptRunsState';
import { usePromptRunData } from './usePromptRunData';
import { usePromptRunActions } from './usePromptRunActions';

const PromptRunsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Custom hooks for data fetching and actions
  const { promptRuns, setPromptRuns, loading, fetchPromptRuns } = usePromptRunData(statusFilter);
  const { handleRatingChange, handleFeedbackChange } = usePromptRunActions(setPromptRuns, setSelectedRun);

  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <PromptRunHeader 
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        fetchPromptRuns={fetchPromptRuns}
      />

      {loading ? (
        <PromptRunLoader />
      ) : promptRuns.length === 0 ? (
        <EmptyPromptRunsState />
      ) : (
        <PromptRunsTable 
          promptRuns={promptRuns} 
          onRatingChange={handleRatingChange} 
          onViewDetails={viewPromptRunDetails} 
        />
      )}

      <PromptRunDetails 
        promptRun={selectedRun} 
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onRatingChange={handleRatingChange}
        onFeedbackChange={handleFeedbackChange}
      />
    </div>
  );
};

export default PromptRunsTab;
