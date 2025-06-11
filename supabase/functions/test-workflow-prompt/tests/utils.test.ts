import { describe, it, expect } from 'vitest';
import { extractJsonFromResponse, replaceVariables } from '../utils.ts';

describe('extractJsonFromResponse', () => {
  it('parses plain JSON string', () => {
    const json = '{"a":1}';
    expect(extractJsonFromResponse(json)).toEqual({ a: 1 });
  });

  it('extracts JSON from fenced code block', () => {
    const response = 'Here is data:\n```json\n{"b":2}\n```';
    expect(extractJsonFromResponse(response)).toEqual({ b: 2 });
  });

  it('returns null on invalid JSON', () => {
    expect(extractJsonFromResponse('no json')).toBeNull();
  });
});

describe('replaceVariables', () => {
  it('replaces variables from context', () => {
    const template = 'Hello {{name}}';
    const result = replaceVariables(template, { name: 'Alice' });
    expect(result).toBe('Hello Alice');
  });

  it('handles missing variable', () => {
    const template = 'Hi {{missing}}';
    const result = replaceVariables(template, {});
    expect(result).toBe(template);
  });
});

describe('extractJsonFromResponse edge cases', () => {
  it('handles text with json object after explanation', () => {
    const response = 'text before {"c":3} text after';
    expect(extractJsonFromResponse(response)).toEqual({ c: 3 });
  });

  it('returns null when json malformed', () => {
    const bad = '{invalid json';
    expect(extractJsonFromResponse(bad)).toBeNull();
  });
});

describe('replaceVariables advanced', () => {
  it('replaces nested variables', () => {
    const template = 'Name: {{user.name}}';
    const result = replaceVariables(template, { user: { name: 'Bob' } });
    expect(result).toBe('Name: Bob');
  });

  it('stringifies object values', () => {
    const template = 'Data: {{obj}}';
    const result = replaceVariables(template, { obj: { a: 1 } });
    expect(result).toContain('"a": 1');
  });
});

import { generateMockResult } from '../utils.ts';

describe('generateMockResult', () => {
  it('returns mock action detection json', () => {
    const res = generateMockResult('action_detection', {});
    const obj = JSON.parse(res);
    expect(obj.decision).toBe('ACTION_NEEDED');
  });

  it('uses context data for multi_project_analysis', () => {
    const res = generateMockResult('multi_project_analysis', { projects_data: [{ id: 'p1' }] });
    const obj = JSON.parse(res);
    expect(obj.projects[0].projectId).toBe('p1');
  });

  it('falls back to default', () => {
    const res = generateMockResult('unknown', {});
    expect(res).toBe('Mock result for unknown');
  });
});
