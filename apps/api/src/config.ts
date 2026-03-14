// Application configuration.
// Secrets are injected as env vars by Cloud Run from Secret Manager.
// Non-secret config is set directly in Terraform (main.tf).

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(optional('PORT', '3000')),
  nodeEnv: optional('NODE_ENV', 'development'),

  // GCP
  gcpProjectId: optional('GCP_PROJECT_ID', ''),

  // Pub/Sub
  pubsubTopic: optional('PUBSUB_TOPIC', 'flag-updates'),
  pubsubSubscription: optional('PUBSUB_SUBSCRIPTION', 'flag-updates-api'),

  // Cache
  cacheTtlSeconds: Number(optional('CACHE_TTL_SECONDS', '60')),

  // Auth provider: 'google-iap' (default/prod), 'dev' (local), 'verika' (Verika integration)
  authProvider: optional(
    'AUTH_PROVIDER',
    process.env['NODE_ENV'] === 'production' ? 'google-iap' : 'dev',
  ),

  // CORS
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((s) => s.trim())
    .reduce<(string | RegExp)[]>((acc, origin) => {
      if (origin.includes('*')) {
        acc.push(new RegExp('^' + origin.replace(/\./g, '\\.').replace('*', '[a-z0-9-]+') + '$'));
      } else {
        acc.push(origin);
      }
      return acc;
    }, []),

  // Secrets (from Secret Manager via Cloud Run)
  // Required in production; falls back to a dev-only dummy in local dev.
  apiSigningKey:
    process.env['NODE_ENV'] === 'production'
      ? required('API_SIGNING_KEY')
      : optional('API_SIGNING_KEY', 'dev-only-insecure-key'),

  // Verika integration (optional — only needed when AUTH_PROVIDER=verika)
  verikaEndpoint: optional('VERIKA_ENDPOINT', ''),
  verikaServiceId: optional('VERIKA_SERVICE_ID', ''),
  verikaAudience: optional('VERIKA_AUDIENCE', ''),
} as const;
