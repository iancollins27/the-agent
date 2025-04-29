
import { useEffect } from 'react';
import { useFilterPersistence } from "@/hooks/useFilterPersistence";

export const usePageSizeHandler = (
  reducedPageSize: boolean,
  updateFilter: (key: string, value: any) => void,
  defaultPageSize: number = 5
) => {
  // Calculate effective page size based on reduced mode
  const effectivePageSize = reducedPageSize ? 2 : defaultPageSize;
  
  // Reset reduced page size after successful load
  useEffect(() => {
    if (reducedPageSize) {
      const timer = setTimeout(() => {
        updateFilter('reducedPageSize', false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [reducedPageSize, updateFilter]);

  return { effectivePageSize };
};
