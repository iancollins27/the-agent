
import { usePromptRunsCore } from './promptRuns/usePromptRunsCore';
import { UsePromptRunsProps } from './promptRuns/types';

/**
 * Hook to fetch and filter prompt runs
 * @deprecated Consider using the more focused hooks in promptRuns/ directly
 */
export const usePromptRuns = (props: UsePromptRunsProps) => {
  return usePromptRunsCore(props);
};
