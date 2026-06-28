# 🏡 Abode

**The affordable property-management platform for small landlords and local property owners.**

Big management companies (AppFolio, Buildium, Yardi) are built for institutional portfolios — high monthly minimums, per-unit fees, and bloated feature sets that small owners don't need and can't justify. Abode gives the independent landlord, the family-run apartment building, and the small business owner the same software superpowers — rent collection, maintenance dispatch, tenant communication, and analytics — without the enterprise price tag.

> One app. Three experiences. Owners run their properties, handymen get the work, tenants get a home that actually responds.

---

## Why Abode

| | Big management companies | **Abode** |
|---|---|---|
| **Pricing** | High monthly minimums + per-unit fees | Built to be affordable for owners with a handful of units |
| **Setup** | Sales calls, onboarding contracts | Self-serve sign-up with invite codes |
| **Maintenance** | Phone trees & paperwork | Tenant snaps a photo → owner assigns → handyman gets paid, all in-app |
| **Built for** | 500+ unit institutional portfolios | Small landlords & local owners |

---

## Who it's for

Abode is one Next.js web app with three role-based experiences:

### 🔑 Owner / Property Manager
- **Dashboard** — portfolio analytics and an at-a-glance apartment grid
- **Fix-It** — assign a maintenance request, get a ranked handyman recommendation, approve the estimate, accept the completed work
- **Invite codes** — onboard tenants and employees without back-and-forth
- Notifications + chat with tenants and handymen

### 🔧 Employee / Handyman
- **Jobs** — accept or decline incoming work
- **Job detail** — submit an estimate → wait for owner approval → upload a receipt to unlock completion + payment
- **Map** — Mapbox view of job locations
- Direct chat with owners

### 🏠 Tenant
- **Home** — your unit and what you owe
- **Issue a request** — describe the problem, attach a photo or video
- **Dues** — pay now with Stripe or pay later
- Chat and notifications

---

## Tech Stack

- **Next.js 15.5** (App Router, TypeScript strict), **React 19**, **Tailwind v4**
- **Drizzle ORM** over **AWS Aurora PostgreSQL Serverless v2** (scale-to-zero)
- **AWS Cognito** auth (httpOnly token cookies + JWT verification)
- **AWS S3** for media (presigned uploads), **Stripe** payments, **Mapbox** maps
- Postgres **Row-Level Security** as the real authorization backstop — every tenant-facing query runs under a per-transaction RLS role
- Infrastructure as idempotent AWS CLI scripts in [`infra/`](infra/)

### Architecture highlights
- **Money is integer cents everywhere** — no floating-point rounding bugs.
- **Reads** are Server Components; **mutations** are Zod-validated Server Actions with role re-checks.
- **RLS-first security** — even a bug in app code can't leak one tenant's data to another, because Postgres enforces isolation at the row level (tested in [`db/verify-rls.ts`](db/verify-rls.ts)).

---

## Getting Started

```bash
# 1. Point .env.local at the dev database (rebuilds creds from AWS)
bash infra/write_env.sh

# 2. Run migrations + seed demo data
npm run db:migrate && npm run db:seed

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The `/login` page has quick-login buttons for seeded **owner / handyman / tenant** accounts, plus real Cognito sign-up.

### Useful commands
```bash
npm run build       # production build
npm run typecheck   # TS strict check
npm run lint        # lint
npm run db:studio   # browse the database
```

---

## Status

Core product (M0–M5) is complete and verified — typecheck, build, runtime smoke tests, and RLS isolation tests all green. Production hardening (RDS Proxy + App Runner) is scripted and ready to deploy.

---

*Built to give small property owners the tools the big companies keep behind enterprise pricing.*
