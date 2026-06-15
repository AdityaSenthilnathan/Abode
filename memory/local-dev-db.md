---
name: local-dev-db
description: Dev runs against a local Postgres, not Aurora; how dev login works offline
metadata:
  type: project
---

Dev is set up to run against a **local native PostgreSQL 17** (service `postgresql-x64-17`, `127.0.0.1:5432`, db `abode`, user/pass `postgres`/`postgres`), NOT the cloud Aurora cluster. `.env.local` `DATABASE_URL` points at localhost with `PGSSL=disable`; the Aurora URL is kept commented below it.

**Why:** Aurora `abode-dev` is IP-locked via its security group and unreachable when the user's public IP changes, and this machine has **no AWS CLI and no AWS credentials** (`AWS_PROFILE=abode` resolves to nothing), so neither the infra scripts nor Cognito work locally. Cognito sign-up therefore fails with "Could not load credentials from any providers."

**How to apply:** For offline UI work, use the `/login` dev quick-login buttons (`ALLOW_DEV_LOGIN=true`) — they bypass Cognito and map an `abode_dev_user` cookie to a seeded row (owner = `owner@abode.dev`). They need a reachable, **seeded** DB: `npm run db:migrate && npm run db:seed` (these now load `.env.local`). Restart `npm run dev` after any `.env.local` change. AWS-only features (real Cognito signup, S3, Stripe) stay broken locally until creds/IP are restored. The leaked root key still needs deleting per CLAUDE.md.
