# Abode infrastructure (AWS CLI)

Idempotent provisioning scripts. **Dev-cheap topology first** (< ~$20/mo):
Aurora Serverless v2 with scale-to-zero auto-pause, **no** RDS Proxy, **no** NAT
Gateway. The app runs locally (`npm run dev`) against the dev DB during the build
phase; the prod cutover (RDS Proxy + NAT + App Runner) is authored in M6.

## ⚠️ Prerequisite — Step 0 (blocking)
The AWS key pasted in chat is **compromised**. Before running anything:
1. Deactivate + delete it (IAM → Users → Security credentials).
2. Create a fresh least-privilege admin key.
3. `aws configure --profile abode`  (region `us-east-1`).

All scripts use `--profile abode`. They never read a key from anywhere but your
local AWS config.

## Run order
```bash
cd infra
cp abode.env.example abode.env      # optional: edit ENV/REGION/etc.
bash run_all.sh                     # 00 → 05 then writes ../.env.local
# …or run individually:
bash 00_prereqs.sh
bash 01_network.sh
bash 02_security_groups.sh
bash 03_aurora.sh                   # ~5–10 min (DB instance create)
bash 04_s3.sh
bash 05_cognito.sh
bash write_env.sh                   # assembles ../.env.local from SSM + Secrets Manager
```
Then, from the repo root:
```bash
npm run db:migrate && npm run db:seed && npm run dev
```

## What gets created (dev)
- **VPC** `10.20.0.0/16` + 2 public + 2 private subnets, IGW (no NAT in dev).
- **Security group** `abode-dev-db` — Postgres 5432 open only to your current public IP.
- **Aurora PostgreSQL Serverless v2** cluster + `db.serverless` instance,
  `MinCapacity=0` auto-pause, **publicly accessible** (dev only, IP-locked, TLS).
  Master password is RDS-managed in Secrets Manager.
- **S3** media bucket — Block Public Access on, CORS for `http://localhost:3000`.
- **Cognito** user pool + groups `owner`/`employee`/`tenant` + confidential app client.
- All IDs/endpoints in **SSM** under `/abode/dev/*`.

## Idempotency & teardown
Re-running any script is safe (each guards `describe || create`). To remove
everything and stop spend:
```bash
bash teardown.sh        # reverse-dependency deletion
```

## Notes
- Dev makes the DB reachable from your laptop via an **IP-allowlisted public
  endpoint** (locked to your IP, TLS required). For a stricter setup use an SSM
  bastion instead — see comments in `03_aurora.sh`.
- **Prod** (`90_*`, M6) flips the DB to private subnets behind an RDS Proxy, adds
  a NAT Gateway, and deploys the app to App Runner via a VPC connector. App code
  is unchanged — the transaction-local RLS pattern already supports the proxy.
