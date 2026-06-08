#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
#
# Regular RDS PostgreSQL — the dev database. Aurora Serverless v2 is BLOCKED on
# the AWS Free Plan, but a normal RDS instance is allowed, so this is what dev
# uses. Reuses the VPC/subnets/SG from 00–02. Aurora is the prod target (90_prod.sh)
# once the account is on a paid plan.
#
# Run order: 00 → 01 → 02 → 03b_rds → 04_s3 → 05_cognito → write_env.sh

INSTANCE_ID="$PREFIX-pg"
SUBNET_GROUP="$PREFIX-dbsubnets"
SG_DB="$(ssm_get sg_db)"; [ -z "$SG_DB" ] && die "run 02_security_groups.sh first"
PUB_A="$(ssm_get subnet_public_a)"; PUB_B="$(ssm_get subnet_public_b)"

if ! aws rds describe-db-subnet-groups --db-subnet-group-name "$SUBNET_GROUP" >/dev/null 2>&1; then
  aws rds create-db-subnet-group --db-subnet-group-name "$SUBNET_GROUP" \
    --db-subnet-group-description "Abode $ENV" --subnet-ids "$PUB_A" "$PUB_B" \
    --tags Key=Project,Value="$PROJECT" Key=Env,Value="$ENV" >/dev/null
fi

if ! aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" >/dev/null 2>&1; then
  aws rds create-db-instance \
    --db-instance-identifier "$INSTANCE_ID" \
    --db-instance-class db.t4g.micro --engine postgres \
    --master-username "$MASTER_USERNAME" --manage-master-user-password \
    --allocated-storage 20 --storage-type gp3 \
    --db-subnet-group-name "$SUBNET_GROUP" \
    --vpc-security-group-ids "$SG_DB" \
    --publicly-accessible --db-name "$DB_NAME" \
    --backup-retention-period 1 --no-multi-az \
    --tags Key=Project,Value="$PROJECT" Key=Env,Value="$ENV" >/dev/null
  log "creating $INSTANCE_ID (5–10 min)…"
fi

log "waiting for DB instance to become available…"
aws rds wait db-instance-available --db-instance-identifier "$INSTANCE_ID"

EP="$(aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" --query 'DBInstances[0].Endpoint.Address' --output text)"
SARN="$(aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" --query 'DBInstances[0].MasterUserSecret.SecretArn' --output text)"
ssm_put db_endpoint "$EP"
ssm_put db_secret_arn "$SARN"
ssm_put db_name "$DB_NAME"

# allow the current machine's IP to reach the DB (publicly accessible, IP-locked)
MYIP="$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]')"
[ -n "$MYIP" ] && aws ec2 authorize-security-group-ingress --group-id "$SG_DB" --protocol tcp --port 5432 --cidr "$MYIP/32" >/dev/null 2>&1 || true

ok "RDS PostgreSQL ready at $EP (db=$DB_NAME)."
log "Next: bash write_env.sh  then  (cd .. && npm run db:migrate && npm run db:seed && npm run dev)"
