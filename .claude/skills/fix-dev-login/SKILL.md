---
name: fix-dev-login
description: >-
  Fix Abode dev sign-in / login that hangs or does nothing, for Brighton (the
  Abode dev) on his local machine — including the
  seeded "Dev quick-login" (owner/handyman/tenant) buttons doing nothing on
  click, or any dev page spinning forever. The usual root cause is the dev
  machine's public IP rotating out of the Aurora Postgres security-group
  allowlist, so the DB handshake stalls and the login Server Action (which does
  a DB lookup) hangs. Use this whenever the user says dev login/sign-in "isn't
  working", "does nothing", "hangs", or the local app "won't load" / "is stuck"
  / "spins" against the dev database. The fix is one idempotent script plus a
  verification pass.
---

# Fix Abode dev login hanging (rotated IP → Aurora SG)

This runbook is for **Brighton**, the Abode developer, on his local dev machine
— it fixes the recurring "I can't sign in" / dev login does nothing problem.

## What's actually happening

The Abode dev database is an **Aurora PostgreSQL Serverless v2** cluster
(`abode-dev`, us-west-1) that is **publicly reachable but IP-locked** to your
machine via a security group. Your home/office public IP rotates over time
(it has been bouncing around `64.40.156.x`). When it rotates, the new IP is no
longer in the security group allowlist, so:

- The Postgres TCP handshake **silently stalls** (the packets are dropped, not
  refused) instead of failing fast.
- `loginAction` and `devLoginAction` (`src/actions/auth.ts`) each do a DB lookup
  on click — so clicking **Sign in** or a **Dev quick-login** button hangs.
- Any other page that touches the DB hangs/spins on first load too.

The cluster itself is almost always fine ("available"); the block is purely the
stale IP. This is a recurring, expected nuisance — not a code regression.

There is already a `connectionTimeoutMillis: 15000` guard in
`src/server/db/client.ts` so an unreachable DB eventually fails fast instead of
hanging forever (and lets `devLoginAction`'s offline `dev:<role>` fallback fire).
Don't remove it. But the real fix is to re-allow the current IP.

## The fix (do this first)

One idempotent command auto-detects the current public IP and adds it (`/32`)
to the Aurora security group. It's safe to re-run any time:

```bash
bash infra/02_security_groups.sh
```

Expect a line like `allowed 5432 from <your-ip>/32`. It uses the local `abode`
AWS profile (per `infra/lib.sh`) — **never** use AWS credentials pasted into
chat. **No dev-server restart is needed**: the running `next dev` process opens
a fresh DB connection on the next request and picks it up immediately.

## Verify the fix end-to-end

Don't stop at running the script — prove it worked, and report the numbers.

1. **Connectivity check (bundled script).** Confirms the IP is allowed and the
   DB authenticates. Run from the repo root:

   ```bash
   node .claude/skills/fix-dev-login/scripts/check-db.mjs
   ```

   A healthy result connects in a few hundred ms and prints
   `✓ DB query OK ... current_user=abode_admin`. A timeout means the IP still
   isn't allowed (re-check the script output above).

2. **Login page serves fast.** If a dev server is running on :3000, a hung DB
   shows up as a slow/blocking response; a healthy one returns in well under a
   second:

   ```bash
   curl -s -o /dev/null -w "HTTP %{http_code} in %{time_total}s\n" --max-time 20 http://localhost:3000/login
   ```

3. **Actually sign in (gold standard).** If the preview/browser tooling is
   available, drive a **Dev quick-login** button and confirm it redirects
   `/login` → `/dashboard`. With the `mcp__Claude_Preview__*` tools: attach with
   `preview_start` (name `dev`, it reuses the running server), navigate to
   `/login`, click the **Owner** button, then confirm `location.pathname`
   becomes `/dashboard`. Check `preview_console_logs` (level `error`) is clean
   and grab a `preview_screenshot` as proof for the user.

## If it still hangs after the SG fix

Work down this list; each rules out a layer:

- **Cluster is paused / waking up.** Scale-to-zero auto-pause means the *first*
  connection after idle can take up to ~15s while Aurora resumes. Just retry the
  check script once; the second attempt should be fast.
- **Cluster isn't "available".** Confirm status:
  `aws --profile abode --region us-west-1 rds describe-db-clusters --db-cluster-identifier abode-dev --query 'DBClusters[0].Status' --output text`.
  If it's not `available`, re-provision idempotently with `bash infra/03_aurora.sh`.
- **Creds / `.env.local` stale or missing.** Rebuild the env from SSM + Secrets
  Manager, then re-migrate: `bash infra/write_env.sh && npm run db:migrate`.
  (The check script's `current_user=abode_admin` line already proves creds are
  good when it passes — so skip this if step 1 passed.)
- **No dev server running.** Start it with `npm run dev` (preview tooling:
  `preview_start` name `dev`), then re-run the verification.

## One-liner for the user

When they hit this again, the whole fix is usually just:

```bash
bash infra/02_security_groups.sh && node .claude/skills/fix-dev-login/scripts/check-db.mjs
```
