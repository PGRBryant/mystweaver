// Labrats JavaScript/TypeScript SDK
// Full implementation coming soon — types and public API surface are defined here.

export interface LabRatsConfig {
  /** Base URL of your Labrats API server, e.g. https://flags.example.com */
  apiUrl: string;
  /** API key for SDK authentication */
  apiKey: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
}

export interface EvaluationContext {
  /** Unique identifier for the user/entity being evaluated */
  userId: string;
  email?: string;
  /** Any additional attributes for targeting rules */
  [key: string]: unknown;
}

export interface LabRatsClient {
  /**
   * Evaluate a boolean feature flag for the given context.
   * Returns `false` if the flag is unknown or the service is unreachable.
   */
  isEnabled(flagKey: string, context: EvaluationContext): Promise<boolean>;

  /** Close the client and release resources. */
  close(): Promise<void>;
}

/**
 * Create a Labrats SDK client.
 *
 * @example
 * ```ts
 * const client = createClient({ apiUrl: 'http://localhost:3000', apiKey: 'my-key' });
 * const enabled = await client.isEnabled('new-dashboard', { userId: 'user-123' });
 * ```
 */
export function createClient(_config: LabRatsConfig): LabRatsClient {
  // TODO: Implement HTTP client with caching and streaming updates.
  throw new Error('SDK not yet implemented — coming soon.');
}
