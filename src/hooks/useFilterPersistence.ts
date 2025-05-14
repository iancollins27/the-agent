
import { useState, useEffect } from 'react';

type FilterValues = Record<string, any>;

export const useFilterPersistence = <T extends FilterValues>(key: string, defaultValues: T) => {
  const [values, setValues] = useState<T>(defaultValues);

  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem(key);
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        setValues(prevValues => ({ ...prevValues, ...parsedFilters }));
      }
    } catch (error) {
      console.error(`Error loading saved filters for ${key}:`, error);
    }
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(values));
    } catch (error) {
      console.error(`Error saving filters for ${key}:`, error);
    }
  }, [values, key]);

  const updateFilter = <K extends keyof T>(key: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  return {
    filters: values,
    setFilters: setValues,
    updateFilter
  };
};
