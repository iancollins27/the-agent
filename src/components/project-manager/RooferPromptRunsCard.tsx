
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PromptRun } from '../admin/types';
import PromptRunsTable from '../admin/PromptRunsTable';
import MultiProjectMessage from './MultiProjectMessage';

interface RooferPromptRunsCardProps {
  roofer: string;
  promptRuns: PromptRun[];
  onViewDetails: (run: PromptRun) => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onRunReviewed: (promptRunId: string) => void;
  onPromptRerun?: (promptRunId: string) => void;
}

const RooferPromptRunsCard: React.FC<RooferPromptRunsCardProps> = ({
  roofer,
  promptRuns,
  onViewDetails,
  onRatingChange,
  onRunReviewed,
  onPromptRerun
}) => {
  return (
    <Card>
      <CardHeader className="pb-2 flex justify-between items-center">
        <CardTitle className="text-lg">{roofer}</CardTitle>
        <MultiProjectMessage rooferName={roofer} projects={promptRuns} />
      </CardHeader>
      <CardContent>
        <PromptRunsTable 
          promptRuns={promptRuns}
          onRatingChange={onRatingChange}
          onViewDetails={onViewDetails}
          onRunReviewed={onRunReviewed}
          onPromptRerun={onPromptRerun}
          reviewFilter="all" // Set to "all" since we're already pre-filtering
        />
      </CardContent>
    </Card>
  );
};

export default RooferPromptRunsCard;
