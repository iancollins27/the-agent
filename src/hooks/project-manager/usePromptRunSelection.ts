
import { useState } from 'react';
import { PromptRun } from '@/components/admin/types';

export const usePromptRunSelection = () => {
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  return {
    selectedRun,
    detailsOpen,
    setDetailsOpen,
    viewPromptRunDetails
  };
};
