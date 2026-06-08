# Abode — project guide

Real-estate SaaS with three role-based experiences in one Next.js web app:
**owner / property-manager**, **employee / handyman**, **tenant**.

## Stack
- **Next.js 15.5** (App Router, TS strict), React 19, Tailwind v4.
- **Drizzle ORM 0.45** over `pg` → **Postgres** (dev: local Docker; prod: Aurora Serverless v2 via RDS Proxy).
- **AWS Cognito** auth (direct SDK + httpOnly token cookies + `aws-jwt-verify`). **S3** media (presigned). **Stripe** payments. **Mapbox** maps. Notifications + live-ish chat via polling (AppSync Events is the documented realtime upgrade).
- Infra via idempotent **AWS CLI** scripts in `infra/`. Provisioned in account **004730169847** (us-west-1).

## Commands
- `npm run dev` — local app (needs the Docker Postgres on :5433, see below)
- `npm run build` / `npm run typecheck` / `npm run lint`
- `npm run db:generate | db:migrate | db:seed`
- Test scripts: `npx tsx scripts/smoke.ts` (page smoke — needs dev server), `db/verify-rls.ts` (RLS isolation), `scripts/test-cognito.ts`, `scripts/test-s3.ts`

### Local dev DB
Dev uses a Docker Postgres (Aurora is blocked on the AWS free plan):
```bash
docker start abode-pg || docker run -d --name abode-pg -e POSTGRES_PASSWORD=abode -e POSTGRES_USER=abode -e POSTGRES_DB=abode -p 5433:5432 postgres:16
DATABASE_URL='postgres://abode:abode@127.0.0.1:5433/abode' PGSSL=disable npm run db:migrate
DATABASE_URL='postgres://abode:abode@127.0.0.1:5433/abode' PGSSL=disable npm run db:seed
npm run dev   # .env.local already points at :5433
```
Dev login: `/login` has quick-login buttons (seeded owner/handyman/tenant) plus real Cognito sign-up/in.

## Features (all built + verified)
- **Tenant:** home (unit + dues), issue request (photo/video → S3), dues (Stripe pay / pay-later), chat, notifications.
- **Owner:** dashboard (analytics + apartment grid), fix-it (Give-Task → ranked handyman, approve estimate, accept completion), notifications, chat, invite-code generation.
- **Handyman:** jobs (accept/decline), job detail (estimate → approval → receipt-gated completion), Mapbox map, chat.
- **Auth/onboarding:** Cognito; PM self-signup, employee via employer code, tenant via unit code.

## Conventions
- **Money is integer cents** everywhere (`formatCents()`).
- **All tenant-facing DB access goes through `withUser(userId, tx => …)`** (`src/server/db/rls.ts`) → per-transaction RLS + `abode_app` role. **`asAdmin()`** only for trusted system work (onboarding, webhooks, notifications). Postgres RLS is the real authz backstop (tested in `db/verify-rls.ts`).
- Reads = Server Components via `src/server/services/*`; mutations = Server Actions (`src/actions/*`, Zod-validated, role re-checked). Role route groups `(owner)/(employee)/(tenant)` + shared `/messages`, `/notifications`.

## Needs your input to fully light up
- **Stripe** test keys → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (card save/charge; webhook at `/api/stripe/webhook`).
- **Mapbox** token → `NEXT_PUBLIC_MAPBOX_TOKEN` (handyman map; falls back to a list without it).
- **AWS account upgrade** to a paid plan → unblocks Aurora + the prod cutover (`infra/90_prod.sh`: NAT + RDS Proxy + ECR + App Runner).

## Security (non-negotiable)
- **Never use credentials pasted into chat.** AWS runs only via the local `abode` profile.
- The leaked **root** key `AKIAQCGPQVH3ZSTAVLHP` (account 004730169847) **must be deleted by you as root** — an IAM user can't remove root keys.

## Status
M0–M5 complete and verified (typecheck + build + runtime smoke + RLS tests green). M6 hardening + prod artifacts ready; the prod deploy run awaits the account upgrade.
