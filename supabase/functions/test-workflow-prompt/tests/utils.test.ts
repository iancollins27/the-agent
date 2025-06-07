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
