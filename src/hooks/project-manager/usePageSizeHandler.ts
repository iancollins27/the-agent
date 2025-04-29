
import { useEffect } from 'react';
import { useFilterPersistence } from "@/hooks/useFilterPersistence";

export const usePageSizeHandler = (
  reducedPageSize: boolean,
  updateFilter: (key: string, value: any) => void,
  defaultPageSize: number = 20 // Increased from 5 to 20
) => {
  // Calculate effective page size based on reduced mode
  const effectivePageSize = reducedPageSize ? 5 : defaultPageSize; // Increased from 2 to 5
  
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
