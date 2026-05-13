import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNow } from './now.js';
import { writeCatalog } from '../storage/catalogCache.js';
import { CITY_ADAPTERS } from '../adapters/index.js';

let stdoutBuf = '';
let stderrBuf = '';
let stdoutSpy: { mockRestore: () => void };
let stderrSpy: { mockRestore: () => void };

beforeEach(async () => {
  process.env.XDG_CACHE_HOME = await mkdtemp(join(tmpdir(), 'twp-now-'));
  stdoutBuf = '';
  stderrBuf = '';
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    stdoutBuf += String(chunk);
    return true;
  }) as typeof process.stdout.write);
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
    stderrBuf += String(chunk);
    return true;
  }) as typeof process.stderr.write);
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

describe('runNow', () => {
  it('emits empty-ref error and exit 1 when no refs given', async () => {
    const code = await runNow([], { json: false });
    expect(code).toBe(1);
    expect(stderrBuf).toContain('no lots specified');
  });

  it('--json: emits structured array with iso updatedAt', async () => {
    await writeCatalog('基隆', [
      { city: '基隆', id: '信二停車場', name: '信二停車場', totalSpaces: 100 },
    ]);
    vi.spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability').mockResolvedValue([
      {
        city: '基隆',
        id: '信二停車場',
        availableSpaces: 25,
        updatedAt: new Date('2026-05-13T03:23:00Z'),
      },
    ]);

    const code = await runNow([{ city: '基隆', id: '信二停車場' }], { json: true });

    expect(code).toBe(0);
    const parsed = JSON.parse(stdoutBuf);
    expect(parsed).toEqual([
      {
        city: '基隆',
        id: '信二停車場',
        name: '信二停車場',
        totalSpaces: 100,
        availableSpaces: 25,
        updatedAt: '2026-05-13T03:23:00.000Z',
        fetchError: null,
      },
    ]);
  });

  it('text mode: emits the table with city/name/availability columns', async () => {
    await writeCatalog('基隆', [{ city: '基隆', id: '信二停車場', name: '信二停車場' }]);
    vi.spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability').mockResolvedValue([
      {
        city: '基隆',
        id: '信二停車場',
        availableSpaces: 25,
        updatedAt: new Date('2026-05-13T03:23:00Z'),
      },
    ]);

    const code = await runNow([{ city: '基隆', id: '信二停車場' }], { json: false });

    expect(code).toBe(0);
    expect(stdoutBuf).toContain('信二停車場');
    expect(stdoutBuf).toContain('25');
    expect(stdoutBuf).not.toContain('\x1b['); // no cursor escape
    expect(stdoutBuf).not.toContain('refresh every'); // no watch header
  });

  it('returns exit 1 when every view has fetchError', async () => {
    await writeCatalog('基隆', [{ city: '基隆', id: 'X', name: 'X' }]);
    vi.spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability').mockRejectedValue(new Error('down'));

    const code = await runNow([{ city: '基隆', id: 'X' }], { json: true });

    expect(code).toBe(1);
  });
});
