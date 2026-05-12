const DEFAULT_TIMEOUT_MS = 10_000;

export class FetchError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'FetchError';
    this.cause = cause;
  }
}

export interface FetchJsonOptions {
  timeoutMs?: number;
  userAgent?: string;
  retries?: number;
  headers?: Record<string, string>;
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchJsonOptions = {},
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    userAgent = 'twparking',
    retries = 1,
    headers = {},
  } = opts;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json', ...headers },
        signal: ac.signal,
      });
      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          lastError = new FetchError(`HTTP ${res.status}`);
          await sleep(200 * (attempt + 1));
          continue;
        }
        throw new FetchError(`HTTP ${res.status} for ${url}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < retries && isRetryable(err)) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      throw err instanceof FetchError ? err : new FetchError(`fetch failed: ${url}`, err);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new FetchError('unknown fetch error');
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  if (err instanceof TypeError) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
