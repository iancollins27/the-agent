
import { useState } from 'react';
import { subHours } from 'date-fns';

export const TIME_FILTERS = {
  LAST_HOUR: 'last_hour',
  LAST_24_HOURS: 'last_24_hours',
  LAST_7_DAYS: 'last_7_days',
  ALL: 'all'
};

export const useTimeFilter = (defaultFilter = TIME_FILTERS.LAST_HOUR) => {
  const [timeFilter, setTimeFilter] = useState(defaultFilter);

  const getDateFilter = () => {
    const now = new Date();
    switch (timeFilter) {
      case TIME_FILTERS.LAST_HOUR:
        return subHours(now, 1).toISOString();
      case TIME_FILTERS.LAST_24_HOURS:
        return subHours(now, 24).toISOString();
      case TIME_FILTERS.LAST_7_DAYS:
        return subHours(now, 168).toISOString();
      case TIME_FILTERS.ALL:
      default:
        return null;
    }
  };

  const getTimeFilterLabel = (filter: string) => {
    switch (filter) {
      case TIME_FILTERS.LAST_HOUR:
        return 'Last Hour';
      case TIME_FILTERS.LAST_24_HOURS:
        return 'Last 24 Hours';
      case TIME_FILTERS.LAST_7_DAYS:
        return 'Last 7 Days';
      case TIME_FILTERS.ALL:
        return 'All Time';
      default:
        return 'Unknown Filter';
    }
  };

  return {
    timeFilter,
    setTimeFilter,
    getDateFilter,
    getTimeFilterLabel,
    TIME_FILTERS
  };
};
