/* @vitest-environment jsdom */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterPersistence } from '../useFilterPersistence';

describe('useFilterPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores saved filters from localStorage', async () => {
    localStorage.setItem('filters', JSON.stringify({ status: 'saved' }));

    const { result } = renderHook(() => useFilterPersistence('filters', { status: 'default' }));

    await waitFor(() => {
      expect(result.current.filters.status).toBe('saved');
    });
  });

  it('saves updated filters to localStorage', async () => {
    const { result } = renderHook(() => useFilterPersistence('filters', { status: 'default' }));

    await waitFor(() => expect(result.current.filters.status).toBe('default'));

    act(() => {
      result.current.updateFilter('status', 'new');
    });

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('filters') || '{}').status).toBe('new');
    });
  });
});
