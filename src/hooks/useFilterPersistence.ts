import { useState, useEffect } from 'react';

type StoredFilterValues = {
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

  return {
    filters: values,
    setFilters: setValues,
    updateFilter: <K extends keyof StoredFilterValues>(
      key: K,
      value: StoredFilterValues[K]
    ) => {
      setValues(prev => ({ ...prev, [key]: value }));
    }
  };
};
