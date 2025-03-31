
import React, { useState } from 'react';
import PromptRunsTable from '../PromptRunsTable';
import PromptRunDetails from '../PromptRunDetails';
import { PromptRun } from '../types';
import PromptRunHeader from './PromptRunHeader';
import PromptRunLoader from './PromptRunLoader';
import EmptyPromptRunsState from './EmptyPromptRunsState';
import { usePromptRunData } from './usePromptRunData';
import { usePromptRunActions } from './usePromptRunActions';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const PromptRunsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [hideReviewed, setHideReviewed] = useState(true);
  
  // Custom hooks for data fetching and actions
  const { promptRuns, setPromptRuns, loading, fetchPromptRuns } = usePromptRunData(statusFilter);
  const { handleRatingChange, handleFeedbackChange } = usePromptRunActions(setPromptRuns, setSelectedRun);

  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  const handleRunReviewed = (promptRunId: string) => {
    // Update the local state to mark the run as reviewed
    setPromptRuns(prev => 
      prev.map(run => 
        run.id === promptRunId ? { ...run, reviewed: true } : run
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PromptRunHeader 
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          fetchPromptRuns={fetchPromptRuns}
        />
        <div className="flex items-center space-x-2">
          <Switch
            id="hide-reviewed-admin"
            checked={hideReviewed}
            onCheckedChange={setHideReviewed}
          />
          <Label htmlFor="hide-reviewed-admin">Hide Reviewed</Label>
        </div>
      </div>

      {loading ? (
        <PromptRunLoader />
      ) : promptRuns.length === 0 ? (
        <EmptyPromptRunsState />
      ) : (
        <PromptRunsTable 
          promptRuns={promptRuns} 
          onRatingChange={handleRatingChange} 
          onViewDetails={viewPromptRunDetails} 
          onRunReviewed={handleRunReviewed}
          hideReviewed={hideReviewed}
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
