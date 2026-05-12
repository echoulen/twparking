import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWriteJson } from './atomicWrite.js';

describe('atomicWriteJson', () => {
  it('writes JSON and leaves no tmp behind', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'twp-'));
    const target = join(dir, 'nested/foo.json');
    await atomicWriteJson(target, { hello: 'world' });
    const text = await readFile(target, 'utf8');
    expect(JSON.parse(text)).toEqual({ hello: 'world' });
    const remains = await readdir(join(dir, 'nested'));
    expect(remains).toEqual(['foo.json']);
  });
});
