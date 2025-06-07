import { describe, it, expect } from 'vitest';
import { parseRequestBody } from '../middleware/requestParser.ts';

describe('parseRequestBody', () => {
  it('rejects non-POST requests', async () => {
    const req = new Request('http://localhost', { method: 'GET' });
    const result = await parseRequestBody(req);
    expect(result.error).toBeInstanceOf(Response);
    expect(result.body).toBeUndefined();
  });

  it('returns error when required fields missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const result = await parseRequestBody(req);
    expect(result.error).toBeInstanceOf(Response);
  });

  it('parses valid body', async () => {
    const body = { promptType: 'test' };
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const result = await parseRequestBody(req);
    expect(result.body).toEqual(body);
    expect(result.error).toBeUndefined();
  });
});
