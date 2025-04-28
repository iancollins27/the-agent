
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PromptRun } from '../admin/types';
import PromptRunsTable from '../admin/PromptRunsTable';

interface RooferPromptRunsCardProps {
  roofer: string;
  promptRuns: PromptRun[];
  onViewDetails: (run: PromptRun) => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onRunReviewed: (promptRunId: string) => void;
  onPromptRerun?: () => void;
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
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{roofer}</CardTitle>
      </CardHeader>
      <CardContent>
        <PromptRunsTable 
          promptRuns={promptRuns}
          onRatingChange={onRatingChange}
          onViewDetails={onViewDetails}
          onRunReviewed={onRunReviewed}
          onPromptRerun={onPromptRerun}
        />
      </CardContent>
    </Card>
  );
};

export default RooferPromptRunsCard;
