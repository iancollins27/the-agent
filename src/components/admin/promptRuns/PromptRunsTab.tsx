
import React, { useState } from 'react';
import PromptRunsTable from '../PromptRunsTable';
import PromptRunDetails from '../PromptRunDetails';
import { PromptRun } from '../types';
import PromptRunHeader from './PromptRunHeader';
import PromptRunLoader from './PromptRunLoader';
import EmptyPromptRunsState from './EmptyPromptRunsState';
import { usePromptRunData } from './usePromptRunData';
import { usePromptRunActions } from './usePromptRunActions';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const PromptRunsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("not-reviewed");
  
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
        <div className="flex items-center space-x-4">
          <Label>Show:</Label>
          <RadioGroup 
            value={reviewFilter} 
            onValueChange={setReviewFilter}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="show-all" />
              <Label htmlFor="show-all">All</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="reviewed" id="show-reviewed" />
              <Label htmlFor="show-reviewed">Reviewed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="not-reviewed" id="show-not-reviewed" />
              <Label htmlFor="show-not-reviewed">Not Reviewed</Label>
            </div>
          </RadioGroup>
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
          reviewFilter={reviewFilter}
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
