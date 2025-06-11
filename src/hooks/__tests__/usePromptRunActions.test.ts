/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePromptRunActions } from '../promptRuns/usePromptRunActions';
import type { PromptRunUI } from '../../types/prompt-run';

const toastMock = vi.fn();

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastMock })
}));

let eqMock: any;
const fromMock = vi.fn(() => ({
  update: vi.fn(() => ({
    eq: eqMock
  }))
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: any[]) => fromMock(...args) }
}));

describe('usePromptRunActions', () => {
  const initialRun: PromptRunUI = {
    id: '1',
    created_at: '',
    status: '',
    ai_provider: '',
    ai_model: '',
    prompt_input: '',
    prompt_output: '',
    error_message: null,
    feedback_rating: null,
    feedback_description: null,
    feedback_tags: null,
    feedback_review: null,
    completed_at: null,
    reviewed: false,
    project_id: null,
    workflow_prompt_id: null,
    workflow_prompt_type: null,
    project_name: null,
    project_address: null,
    project_next_step: null,
    project_crm_url: null,
    project_roofer_contact: null,
    project_manager: null,
    relative_time: '',
    workflow_type: null,
    error: false,
    toolLogsCount: 0
  };

  beforeEach(() => {
    toastMock.mockClear();
    eqMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ update: () => ({ eq: eqMock }) });
  });

  it('updates rating successfully', async () => {
    const { result } = renderHook(() => {
      const [runs, setRuns] = React.useState<PromptRunUI[]>([initialRun]);
      const actions = usePromptRunActions(setRuns);
      return { runs, actions };
    });

    await act(async () => {
      await result.current.actions.handleRatingChange('1', 5);
    });

    expect(result.current.runs[0].feedback_rating).toBe(5);
    expect(eqMock).toHaveBeenCalledWith('id', '1');
    expect(toastMock).toHaveBeenCalled();
  });

  it('handles supabase error', async () => {
    eqMock = vi.fn().mockResolvedValue({ error: new Error('fail') });
    fromMock.mockReturnValue({ update: () => ({ eq: eqMock }) });
    const { result } = renderHook(() => {
      const [runs, setRuns] = React.useState<PromptRunUI[]>([initialRun]);
      const actions = usePromptRunActions(setRuns);
      return { runs, actions };
    });

    await act(async () => {
      await result.current.actions.handleRatingChange('1', 5);
    });

    expect(result.current.runs[0].feedback_rating).toBeNull();
    expect(toastMock).toHaveBeenCalled();
  });
});
