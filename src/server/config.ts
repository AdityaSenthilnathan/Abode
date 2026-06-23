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

/**
 * Dev-only offline bypass. Enabled on a non-production box that opts in via
 * ALLOW_DEV_LOGIN. Used to stand in for external services (Cognito auth, Stripe
 * payments) when their credentials aren't configured locally. ALWAYS false in
 * production, so these shortcuts can never run against real users.
 */
export function devBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";
}

/**
 * Demo login. Lets a visitor sign in as a pre-seeded demo account
 * (owner / handyman / tenant) with one click and no password, to explore the
 * product — this powers the "Demo login" buttons on the sign-in page.
 *
 * Unlike `devBypass()`, this is allowed in PRODUCTION when ALLOW_DEMO_LOGIN is
 * set, so it can be exposed on the live site. It stays on automatically wherever
 * the dev bypass is on, so local dev keeps its buttons with no extra config.
 *
 * Crucially this only ever logs into existing seeded rows; it never bypasses
 * Cognito for real sign-ups (that remains `devBypass()`, dev-only). Enabling it
 * means everyone shares the same demo accounts — only seed data you're happy to
 * expose publicly should live under them.
 */
export function demoLogin(): boolean {
  return process.env.ALLOW_DEMO_LOGIN === "true" || devBypass();
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
