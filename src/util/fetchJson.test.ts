import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson, FetchError } from './fetchJson.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchJson', () => {
  it('returns parsed JSON on 200', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ a: 1 }), { status: 200 }));
    await expect(fetchJson('https://x/y', { retries: 0 })).resolves.toEqual({ a: 1 });
  });

  it('retries once on 500 then succeeds', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = mock;
    await expect(fetchJson('https://x/y', { retries: 1 })).resolves.toEqual({ ok: true });
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('throws FetchError on 4xx without retry', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));
    await expect(fetchJson('https://x/y', { retries: 1 })).rejects.toBeInstanceOf(FetchError);
  });
});
