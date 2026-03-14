/** Minimal fetch wrapper with timeout and auth header injection. */
export class HttpClient {
  private baseUrl: string;
  private timeout: number;
  // TODO(verika): tokenResolver abstracts the auth source so Verika tokens and
  // static SDK keys are handled identically by the HTTP layer.
  private readonly tokenResolver: () => Promise<string>;

  constructor(baseUrl: string, tokenResolver: () => Promise<string>, timeout: number) {
    // Strip trailing slash for consistent URL joining.
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.tokenResolver = tokenResolver;
    this.timeout = timeout;
  }

  async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const token = await this.tokenResolver();
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new HttpError(res.status, await res.text().catch(() => ''));
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const token = await this.tokenResolver();
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new HttpError(res.status, await res.text().catch(() => ''));
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`HTTP ${status}: ${body}`);
    this.name = 'HttpError';
  }
}
