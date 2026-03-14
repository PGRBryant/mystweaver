import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient, HttpError } from './http';

describe('HttpClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST with correct headers and body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: true }),
    });

    const client = new HttpClient('https://api.example.com', () => Promise.resolve('test-key'), 5000);
    const result = await client.post('/sdk/evaluate', { flagKey: 'my-flag' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/sdk/evaluate');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(opts.body)).toEqual({ flagKey: 'my-flag' });
    expect(result).toEqual({ value: true });
  });

  it('strips trailing slashes from baseUrl', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const client = new HttpClient('https://api.example.com///', () => Promise.resolve('key'), 5000);
    await client.post('/path', {});

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/path');
  });

  it('throws HttpError on non-OK response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    const client = new HttpClient('https://api.example.com', () => Promise.resolve('bad-key'), 5000);
    await expect(client.post('/sdk/evaluate', {})).rejects.toThrow(HttpError);

    try {
      await client.post('/sdk/evaluate', {});
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(401);
      expect((err as HttpError).body).toBe('Unauthorized');
    }
  });

  it('aborts request on timeout', async () => {
    fetchMock.mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    const client = new HttpClient('https://api.example.com', () => Promise.resolve('key'), 50);
    await expect(client.post('/slow', {})).rejects.toThrow('aborted');
  });
});
