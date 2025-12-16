import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/providers/openAIProvider.ts', () => ({
  processOpenAIRequest: vi.fn()
}));

vi.mock('../services/providers/claudeProvider.ts', () => ({
  processClaudeRequest: vi.fn()
}));

vi.mock('../knowledge-service.ts', () => ({
  searchKnowledgeBase: vi.fn()
}));

vi.mock('../human-service.ts', () => ({
  requestHumanReview: vi.fn()
}));

vi.mock('../database/actions.ts', () => ({
  createActionRecord: vi.fn(),
  createReminder: vi.fn()
}));

import { handleAIResponse } from '../services/aiResponseHandler.ts';
import { processOpenAIRequest } from '../services/providers/openAIProvider.ts';
import { processClaudeRequest } from '../services/providers/claudeProvider.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleAIResponse', () => {
  it('uses OpenAI provider when name does not include claude', async () => {
    (processOpenAIRequest as any).mockResolvedValue({ result: 'ok' });
    const res = await handleAIResponse({}, 'openai', 'model', 'prompt', 'run', 'proj', 'type', false, {});
    expect(processOpenAIRequest).toHaveBeenCalled();
    expect(processClaudeRequest).not.toHaveBeenCalled();
    expect(res).toEqual({ result: 'ok' });
  });

  it('uses Claude provider when name contains claude', async () => {
    (processClaudeRequest as any).mockResolvedValue({ result: 'c' });
    const res = await handleAIResponse({}, 'claude-v2', 'model', 'prompt', 'run', 'proj', 'type', false, {});
    expect(processClaudeRequest).toHaveBeenCalled();
    expect(processOpenAIRequest).not.toHaveBeenCalled();
    expect(res).toEqual({ result: 'c' });
  });

  it('returns processed tool outputs for MCP', async () => {
    const toolOutputs = [
      { tool: 'create_action_record', args: {}, result: { action_record_id: 'a1' } }
    ];
    (processOpenAIRequest as any).mockResolvedValue({ result: 'final', toolOutputs });
    const res = await handleAIResponse({}, 'openai', 'model', 'prompt', 'run', 'proj', 'type', true, {});
    expect(res.actionRecordId).toBe('a1');
    expect(res.toolOutputs).toEqual(toolOutputs);
  });
});
