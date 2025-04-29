
import { useMemo } from 'react';
import { PromptRun } from '@/components/admin/types';

export const usePromptRunProcessor = (
  promptRuns: PromptRun[],
  hideReviewed: boolean,
  sortRooferAlphabetically: boolean
) => {
  // Process prompt runs for display
  const processedPromptRuns = useMemo(() => {
    let runs = [...promptRuns];

    // Apply hide reviewed filter if needed
    if (hideReviewed) {
      runs = runs.filter(run => !run.reviewed);
    }

    // Apply alphabetical sorting if needed
    if (sortRooferAlphabetically) {
      runs.sort((a, b) => {
        const rooferA = a.project_roofer_contact || 'zzz';
        const rooferB = b.project_roofer_contact || 'zzz';
        return rooferA.localeCompare(rooferB);
      });
    }
    
    return runs;
  }, [promptRuns, hideReviewed, sortRooferAlphabetically]);

  return { processedPromptRuns };
};
