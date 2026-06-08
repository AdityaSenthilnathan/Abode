import "server-only";

/**
 * Centralized, lazily-validated runtime config.
 *
 * AWS values are intentionally OPTIONAL so the app boots locally before the
 * infrastructure is provisioned. Use `requireEnv()` at the point of use when a
 * value is actually needed, so failures are specific and late rather than
 * crashing the whole process at import time.
 */
function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function requireEnv(name: string): string {
  const v = opt(name);
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  appUrl: opt("APP_URL") ?? "http://localhost:3000",
  aws: {
    region: opt("AWS_REGION") ?? "us-east-1",
  },
  db: {
    url: opt("DATABASE_URL"),
  },
  cognito: {
    userPoolId: opt("COGNITO_USER_POOL_ID"),
    clientId: opt("COGNITO_CLIENT_ID"),
    clientSecret: opt("COGNITO_CLIENT_SECRET"),
    domain: opt("COGNITO_DOMAIN"),
  },
  s3: {
    mediaBucket: opt("S3_MEDIA_BUCKET"),
  },
  stripe: {
    secretKey: opt("STRIPE_SECRET_KEY"),
    webhookSecret: opt("STRIPE_WEBHOOK_SECRET"),
    publishableKey: opt("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  },
} as const;
