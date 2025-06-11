/* @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const fetchMock = vi.fn();
const filterMock = vi.fn();
const actionsMock = { handleRatingChange: vi.fn(), handleFeedbackChange: vi.fn() };

vi.mock('../promptRuns/usePromptRunsFetcher', () => ({
  usePromptRunsFetcher: () => ({ fetchPromptRuns: fetchMock })
}));
vi.mock('../promptRuns/usePromptRunFilters', () => ({
  usePromptRunFilters: () => ({ applyFilters: filterMock })
}));
vi.mock('../promptRuns/usePromptRunActions', () => ({
  usePromptRunActions: () => actionsMock
}));

let usePromptRunsCore: typeof import('../promptRuns/usePromptRunsCore').usePromptRunsCore;

beforeAll(async () => {
  ({ usePromptRunsCore } = await import('../promptRuns/usePromptRunsCore'));
});

describe('usePromptRunsCore', () => {
  const sampleRun = {
    id: '1',
    created_at: '2024-01-01T00:00:00Z',
    status: 'done',
    ai_provider: 'openai',
    ai_model: 'gpt',
    prompt_input: '',
    prompt_output: '',
    error_message: null,
    relative_time: '',
    toolLogsCount: 0
  };

  beforeEach(() => {
    fetchMock.mockResolvedValue([sampleRun]);
    filterMock.mockResolvedValue([sampleRun]);
  });

  it('fetches and maps prompt runs', async () => {
    const { result } = renderHook(() =>
      usePromptRunsCore({
        userProfile: { company_id: 'c1' },
        statusFilter: null,
        onlyShowMyProjects: false,
        projectManagerFilter: null,
        timeFilter: 'all',
        getDateFilter: () => null
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith(null);
    expect(filterMock).toHaveBeenCalled();
    expect(result.current.promptRuns[0].id).toBe('1');
  });
});
