
import React from 'react';
import PromptRunDetails from '../admin/PromptRunDetails';
import { PromptRun } from '../admin/types';

interface ProjectManagerDetailsPanelProps {
  selectedRun: PromptRun | null;
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onFeedbackChange: (promptRunId: string, feedback: { 
    description?: string; 
    tags?: string[] 
  }) => void;
  onPromptRerun: () => void;
}

const ProjectManagerDetailsPanel: React.FC<ProjectManagerDetailsPanelProps> = ({
  selectedRun,
  detailsOpen,
  setDetailsOpen,
  onRatingChange,
  onFeedbackChange,
  onPromptRerun
}) => {
  return (
    <PromptRunDetails 
      promptRun={selectedRun} 
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
      onRatingChange={onRatingChange}
      onFeedbackChange={onFeedbackChange}
      onPromptRerun={onPromptRerun}
    />
  );
};

export default ProjectManagerDetailsPanel;
