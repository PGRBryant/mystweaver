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

  // Redis
  redisHost: optional('REDIS_HOST', 'localhost'),
  redisPort: Number(optional('REDIS_PORT', '6379')),

  // Pub/Sub
  pubsubTopic: optional('PUBSUB_TOPIC', 'flag-updates'),
  pubsubSubscription: optional('PUBSUB_SUBSCRIPTION', 'flag-updates-api'),

  // Cache
  cacheTtlSeconds: Number(optional('CACHE_TTL_SECONDS', '60')),

  // Secrets (from Secret Manager via Cloud Run)
  // Required in production; falls back to a dev-only dummy in local dev.
  apiSigningKey:
    process.env['NODE_ENV'] === 'production'
      ? required('API_SIGNING_KEY')
      : optional('API_SIGNING_KEY', 'dev-only-insecure-key'),
} as const;
