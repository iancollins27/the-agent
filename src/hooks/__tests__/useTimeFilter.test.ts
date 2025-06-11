/* @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTimeFilter, TIME_FILTERS } from '../useTimeFilter';
import { subHours } from 'date-fns';

const FIXED_DATE = new Date('2024-01-01T12:00:00Z');

describe('useTimeFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  it('returns correct date values for each filter', () => {
    const { result } = renderHook(() => useTimeFilter());

    // default ALL
    expect(result.current.getDateFilter()).toBeNull();

    act(() => result.current.setTimeFilter(TIME_FILTERS.LAST_HOUR));
    expect(result.current.getDateFilter()).toBe(subHours(FIXED_DATE, 1).toISOString());

    act(() => result.current.setTimeFilter(TIME_FILTERS.LAST_24_HOURS));
    expect(result.current.getDateFilter()).toBe(subHours(FIXED_DATE, 24).toISOString());

    act(() => result.current.setTimeFilter(TIME_FILTERS.LAST_7_DAYS));
    expect(result.current.getDateFilter()).toBe(subHours(FIXED_DATE, 168).toISOString());
  });

  it('returns correct labels for filters', () => {
    const { result } = renderHook(() => useTimeFilter());

    expect(result.current.getTimeFilterLabel(TIME_FILTERS.LAST_HOUR)).toBe('Last Hour');
    expect(result.current.getTimeFilterLabel(TIME_FILTERS.LAST_24_HOURS)).toBe('Last 24 Hours');
    expect(result.current.getTimeFilterLabel(TIME_FILTERS.LAST_7_DAYS)).toBe('Last 7 Days');
    expect(result.current.getTimeFilterLabel(TIME_FILTERS.ALL)).toBe('All Time');
  });
});
