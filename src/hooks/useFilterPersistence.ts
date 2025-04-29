
import { useState, useEffect } from 'react';

export type StoredFilterValues = {
  hideReviewed: boolean;
  excludeReminderActions: boolean;
  timeFilter: string;
  statusFilter: string | null;
  onlyMyProjects: boolean;
  projectManagerFilter: string | null;
  groupByRoofer: boolean;
  sortRooferAlphabetically: boolean;
  onlyPendingActions: boolean;
};

export const useFilterPersistence = (defaultValues: StoredFilterValues) => {
  const [values, setValues] = useState<StoredFilterValues>({
    ...defaultValues,
    onlyPendingActions: true
  });

  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem('projectManagerFilters');
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        setValues(parsedFilters);
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('projectManagerFilters', JSON.stringify(values));
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  }, [values]);

  // Updated the updateFilter function to have a more generic type signature
  // This will allow it to be compatible with the expected type in ProjectManagerDashboard.tsx
  const updateFilter = <K extends string>(
    key: K, 
    value: any
  ): void => {
    setValues(prev => ({ 
      ...prev, 
      [key]: value 
    }));
  };

  return {
    filters: values,
    setFilters: setValues,
    updateFilter
  };
};
