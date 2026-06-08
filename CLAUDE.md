# Abode — project guide

Real-estate SaaS with three role-based experiences in one Next.js web app:
**owner / property-manager**, **employee / handyman**, **tenant**.

## Stack
- **Next.js 15.5** (App Router, TypeScript strict), React 19, Tailwind v4.
- **Drizzle ORM 0.45** over `pg` → **Aurora PostgreSQL** (dev: Serverless v2 auto-pause, no proxy).
- **AWS Cognito** auth (3 groups). **Stripe** payments. **S3** media. **AppSync Events** realtime. **Mapbox** maps.
- Infra via idempotent **AWS CLI** scripts in `infra/` (dev-cheap topology first).

## Commands
- `npm run dev` — local app at http://localhost:3000
- `npm run build` / `npm run typecheck` / `npm run lint`
- `npm run db:generate` — regenerate SQL migrations from `db/schema.ts`
- `npm run db:migrate` — apply migrations **+ `db/policies.sql`** (RLS)
- `npm run db:seed` — wipe + load dev data

## Layout
- `db/` — `schema.ts` (single source of truth), `migrations/`, `policies.sql` (RLS), `migrate.ts`, `seed.ts`
- `src/app/` — route groups `(auth)`, `(owner)`, `(employee)`, `(tenant)`; `api/`
- `src/server/` — server-only: `config.ts`, `db/{client,rls}.ts`, `auth/{session,guard}.ts`, (later) `services/`, `stripe/`, `realtime/`
- `src/components/`, `src/lib/`
- `infra/` — AWS CLI provisioning scripts

## Conventions (important)
- **Money is integer cents** everywhere. Format with `formatCents()`.
- **All tenant-facing DB access goes through `withUser(userId, tx => …)`** (`src/server/db/rls.ts`), which sets the per-transaction RLS context and switches to the `abode_app` role. Use **`asAdmin()`** only for trusted system work (onboarding, Stripe webhooks, notification fan-out).
- RLS in Postgres is the real authorization backstop; middleware + `assertRole()` in each role layout are the coarse gates. Don't rely on app code alone.
- Reads = Server Components via the service layer; mutations = Server Actions (Zod-validate, re-check role).

## Security (non-negotiable)
- **Never use credentials pasted into chat.** AWS runs only via the local `abode` profile (`--profile abode`).
- The access key `AKIAQCGPQVH3ZSTAVLHP` was exposed and **must be deactivated/rotated** (Step 0). Treat it as compromised.

## Status
- **M0 foundation done** (scaffold, DB schema + RLS + seed, dev auth shim, role shells).
- **Blocked on Step 0** (rotate key + `aws configure --profile abode`) before any AWS provisioning.
- Auth is currently a **dev shim** (cookie picks a seeded role); replaced by Cognito in M1.

See the full roadmap in `.claude/plans/take-this-seriously-because-idempotent-charm.md`.
