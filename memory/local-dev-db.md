---
name: local-dev-db
description: Dev runs against a local Postgres, not Aurora; how dev login works offline
metadata:
  type: project
---

Dev is set up to run against a **local native PostgreSQL 17** (service `postgresql-x64-17`, `127.0.0.1:5432`, db `abode`, user/pass `postgres`/`postgres`), NOT the cloud Aurora cluster. `.env.local` `DATABASE_URL` points at localhost with `PGSSL=disable`; the Aurora URL is kept commented below it.

**Why:** Aurora `abode-dev` is IP-locked via its security group and unreachable when the user's public IP changes, and this machine has **no AWS CLI and no AWS credentials** (`AWS_PROFILE=abode` resolves to nothing, no `~/.aws/credentials`), so the infra scripts and any direct AWS SDK call (Cognito/S3) can't authenticate — the AWS SDK throws "Could not load credentials from any providers."

**How to apply:** For offline UI work, use the `/login` dev quick-login buttons (`ALLOW_DEV_LOGIN=true`) — they bypass Cognito and map an `abode_dev_user` cookie to a seeded row (owner = `owner@abode.dev`). **The `/signup` forms also work offline now:** the signup actions in `src/actions/auth.ts` honor the same `ALLOW_DEV_LOGIN` flag (`devAuthBypass()`/`createAccount`/`startSession`) — they skip Cognito, insert a local users row with a synthetic `dev:<uuid>` sub, and set the dev cookie. Both need a reachable, **seeded** DB: `npm run db:migrate && npm run db:seed` (these load `.env.local`). Restart `npm run dev` after any `.env.local` change. `loginAction` has a matching dev branch: with `ALLOW_DEV_LOGIN` on it logs in any existing local user **by email alone** (password ignored — no offline password store, same trust model as quick-login), so dev-created accounts can log back in. Real Cognito signup/login (and S3, Stripe) still need creds/IP restored; in production Cognito enforces the real password (the dev branches are dead when `NODE_ENV=production`). The leaked root key still needs deleting per CLAUDE.md.
